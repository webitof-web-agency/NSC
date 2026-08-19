const Customer = require('../../models/Customer');
const WhatsAppCampaign = require('../models/WhatsAppCampaign');
const WhatsAppMessageLog = require('../models/WhatsAppMessageLog');
const WhatsAppMetaTemplate = require('../models/WhatsAppMetaTemplate');
const { sendTemplateMessage } = require('../services/whatsappService');
const { normalizePhoneNumber } = require('../utils/phoneFormatter');
const { buildTemplateComponents } = require('../services/whatsappService');
const crypto = require('crypto');

const WHATSAPP_CAMPAIGN_CONCURRENCY = process.env.WHATSAPP_CAMPAIGN_CONCURRENCY ? parseInt(process.env.WHATSAPP_CAMPAIGN_CONCURRENCY) : 5;
const LEASE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Helper to delay execution
const delay = ms => new Promise(res => setTimeout(res, ms));

async function getEligibleCustomers(req, res) {
  try {
    const customers = await Customer.find({ 
      userId: req.user._id,
      isDeleted: false,
      status: 'Active'
    });

    const eligible = [];
    const invalidPhone = [];
    const notOptedIn = [];
    const optedOut = [];

    for (const c of customers) {
      if (!c.phone || c.phone.trim() === '') {
        invalidPhone.push(c);
        continue;
      }
      
      let normalized = null;
      try {
        normalized = normalizePhoneNumber(c.phone);
      } catch (e) {}

      if (!normalized) {
        invalidPhone.push(c);
        continue;
      }

      if (c.whatsappMarketingOptOutAt) {
        optedOut.push(c);
        continue;
      }

      if (!c.whatsappMarketingOptIn) {
        notOptedIn.push(c);
        continue;
      }

      eligible.push(c);
    }

    res.json({
      success: true,
      stats: {
        total: customers.length,
        eligible: eligible.length,
        invalidPhone: invalidPhone.length,
        notOptedIn: notOptedIn.length,
        optedOut: optedOut.length
      },
      eligibleCustomers: eligible.map(c => ({
        _id: c._id,
        name: c.name,
        phone: c.phone,
        companyName: c.billingAddress?.name || ''
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function createCampaign(req, res) {
  try {
    const { 
      name, 
      metaTemplateId, 
      selectedCustomerIds, 
      variableMappings, 
      headerMapping, 
      buttonMappings
    } = req.body;
    
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey || crypto.randomUUID();

    // Check if campaign with this idempotency key already exists for this user
    let campaign = await WhatsAppCampaign.findOne({ userId: req.user._id, idempotencyKey });
    if (campaign) {
      return res.status(200).json({ success: true, campaignId: campaign._id, message: 'Campaign already queued (idempotent)' });
    }

    const template = await WhatsAppMetaTemplate.findOne({ metaId: metaTemplateId });
    if (!template || template.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: 'Invalid or unapproved template.' });
    }

    if (template.category !== 'MARKETING') {
      return res.status(400).json({ success: false, message: 'Only MARKETING templates can be used for campaigns.' });
    }

    const customers = await Customer.find({ _id: { $in: selectedCustomerIds }, userId: req.user._id });
    
    // Deduplicate and filter eligible
    const uniquePhones = new Set();
    const finalEligibleCustomers = [];
    let excludedCount = 0;

    for (const c of customers) {
      let normPhone = null;
      try { normPhone = normalizePhoneNumber(c.phone); } catch (e) {}
      
      if (!normPhone || !c.whatsappMarketingOptIn || c.whatsappMarketingOptOutAt || uniquePhones.has(normPhone)) {
        excludedCount++;
        continue;
      }
      uniquePhones.add(normPhone);
      finalEligibleCustomers.push({ customer: c, phone: normPhone });
    }

    if (finalEligibleCustomers.length === 0) {
      return res.status(400).json({ success: false, message: 'No eligible customers selected for the campaign.' });
    }

    campaign = await WhatsAppCampaign.create({
      userId: req.user._id,
      name,
      idempotencyKey,
      template: {
        metaTemplateId: template.metaId,
        name: template.name,
        language: template.language,
        category: template.category
      },
      status: 'QUEUED',
      totalSelected: selectedCustomerIds.length,
      totalEligible: finalEligibleCustomers.length,
      totalExcluded: excludedCount,
      queuedCount: finalEligibleCustomers.length,
      variableMappings: variableMappings || [],
      headerMapping: headerMapping || { sourceType: 'NONE' },
      buttonMappings: buttonMappings || [],
      createdBy: req.user._id,
    });

    const logsToCreate = finalEligibleCustomers.map(item => ({
      userId: campaign.userId,
      customerId: item.customer._id,
      customerPhone: item.phone,
      customerName: item.customer.name,
      campaignId: campaign._id,
      documentType: 'MARKETING',
      status: 'QUEUED',
      nextRetryAt: new Date(),
      renderedMessage: `Campaign: ${campaign.name}`,
      metadata: { templateName: campaign.template.name }
    }));

    await WhatsAppMessageLog.insertMany(logsToCreate, { ordered: false });

    // Background process
    processCampaign(campaign._id).catch(err => console.error('Campaign Processing Error:', err));

    res.status(201).json({ success: true, campaignId: campaign._id, message: 'Campaign queued successfully' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Idempotency conflict. Please retry with a new key if intentional.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
}

async function processCampaign(campaignId) {
  try {
    const campaign = await WhatsAppCampaign.findById(campaignId);
    if (!campaign) return;

    const template = await WhatsAppMetaTemplate.findOne({ metaId: campaign.template.metaTemplateId });
    if (!template || template.status !== 'APPROVED' || template.category !== 'MARKETING') {
      campaign.status = 'FAILED';
      await campaign.save();
      await WhatsAppMessageLog.updateMany(
        { campaignId, status: 'QUEUED' },
        { $set: { status: 'FAILED', errorMessage: 'Template is no longer APPROVED/MARKETING' } }
      );
      return;
    }

    if (campaign.status === 'QUEUED') {
      campaign.status = 'PROCESSING';
      campaign.startedAt = new Date();
      await campaign.save();
    }

    const WhatsAppSettings = require('../models/WhatsAppSettings');
    const { mergeConfig } = require('../services/whatsappService');
    const settingsDoc = await WhatsAppSettings.findOne({ userId: campaign.userId });
    const config = mergeConfig(settingsDoc);

    if (!config.isEnabled) {
      campaign.status = 'FAILED';
      await campaign.save();
      await WhatsAppMessageLog.updateMany(
        { campaignId, status: 'QUEUED' },
        { $set: { status: 'FAILED', errorMessage: 'WhatsApp is disabled' } }
      );
      return;
    }

    const workerId = crypto.randomUUID();
    let hasMore = true;

    while (hasMore) {
      const now = new Date();
      
      // Attempt to find any job that crashed after requestStartedAt but never completed
      const crashedJobs = await WhatsAppMessageLog.find({
        campaignId,
        status: 'PROCESSING',
        requestStartedAt: { $ne: null },
        processingLeaseUntil: { $lt: now }
      });

      for (const crashed of crashedJobs) {
        // Prevent duplicate ads
        await WhatsAppMessageLog.findByIdAndUpdate(crashed._id, {
          $set: { status: 'DELIVERY_UNKNOWN', errorMessage: 'Worker crashed mid-flight. Skipped to prevent spam.' }
        });
        await WhatsAppCampaign.findByIdAndUpdate(campaignId, { $inc: { failedCount: 1, queuedCount: -1 } });
      }

      // Claim jobs atomically
      const logsToProcess = await WhatsAppMessageLog.find({
        campaignId,
        $or: [
          { status: 'QUEUED', nextRetryAt: { $lte: now } },
          { status: 'PROCESSING', processingLeaseUntil: { $lt: now }, requestStartedAt: null }
        ]
      }).limit(WHATSAPP_CAMPAIGN_CONCURRENCY);

      if (logsToProcess.length === 0) {
        hasMore = false;
        break;
      }

      const logIds = logsToProcess.map(l => l._id);
      
      // Only successfully claimed jobs
      const claimedResult = await WhatsAppMessageLog.updateMany(
        { _id: { $in: logIds }, $or: [{ status: 'QUEUED' }, { status: 'PROCESSING' }] },
        { 
          $set: { 
            status: 'PROCESSING', 
            processingBy: workerId, 
            processingStartedAt: now, 
            processingLeaseUntil: new Date(now.getTime() + LEASE_DURATION_MS) 
          } 
        }
      );

      if (claimedResult.modifiedCount === 0) continue; // Someone else grabbed them

      const claimedLogs = await WhatsAppMessageLog.find({ _id: { $in: logIds }, processingBy: workerId });

      await Promise.allSettled(claimedLogs.map(async (log) => {
        const customer = await Customer.findById(log.customerId);
        if (!customer) {
          await WhatsAppMessageLog.findByIdAndUpdate(log._id, { $set: { status: 'FAILED', errorMessage: 'Customer not found' } });
          await WhatsAppCampaign.findByIdAndUpdate(campaignId, { $inc: { failedCount: 1, queuedCount: -1 } });
          return;
        }

        const phone = log.customerPhone;
        const context = {
          customerName: customer.name,
          customerPhone: customer.phone,
          companyName: customer.billingAddress?.name || ''
        };

        const components = buildTemplateComponents(campaign, context);

        let attempt = log.attemptCount + 1;
        let success = false;
        let lastError = null;

        // Mark request as started to engage crash protection
        await WhatsAppMessageLog.findByIdAndUpdate(log._id, { 
          $set: { requestStartedAt: new Date(), attemptCount: attempt } 
        });

        try {
          const response = await sendTemplateMessage({
            config, phone, templateName: campaign.template.name, languageCode: campaign.template.language, components
          });

          const messageId = response?.messages?.[0]?.id || '';
          await WhatsAppMessageLog.findByIdAndUpdate(log._id, {
            $set: {
              messageId,
              status: 'ACCEPTED',
              acceptedAt: new Date(),
              lastAttemptAt: new Date()
            }
          });

          await WhatsAppCampaign.findByIdAndUpdate(campaign._id, { $inc: { acceptedCount: 1, queuedCount: -1 } });
          success = true;
        } catch (err) {
          lastError = err;
          const status = err.statusCode || 500;
          
          if (status === 429 || status >= 500) { // Transient errors
            if (attempt >= 3) {
              await WhatsAppMessageLog.findByIdAndUpdate(log._id, {
                $set: { status: 'FAILED', errorMessage: err.message || 'Meta Error', lastErrorCode: String(status), lastAttemptAt: new Date() }
              });
              await WhatsAppCampaign.findByIdAndUpdate(campaign._id, { $inc: { failedCount: 1, queuedCount: -1 } });
            } else {
              const backoffMs = Math.pow(2, attempt) * 1000;
              await WhatsAppMessageLog.findByIdAndUpdate(log._id, {
                $set: { 
                  status: 'QUEUED', 
                  nextRetryAt: new Date(Date.now() + backoffMs), 
                  lastErrorCode: String(status), 
                  requestStartedAt: null, // Clear request started so it can be retried safely
                  processingBy: null 
                }
              });
            }
          } else { // Permanent error (e.g. 400 Bad Request)
            await WhatsAppMessageLog.findByIdAndUpdate(log._id, {
              $set: { status: 'FAILED', errorMessage: err.message || 'Invalid Template Data', lastErrorCode: String(status), lastAttemptAt: new Date() }
            });
            await WhatsAppCampaign.findByIdAndUpdate(campaign._id, { $inc: { failedCount: 1, queuedCount: -1 } });
          }
        }
      }));
      
      await delay(500); // Wait between batches
    }

    // Finalize
    const finalCampaign = await WhatsAppCampaign.findById(campaignId);
    
    const remainingCount = await WhatsAppMessageLog.countDocuments({ 
      campaignId, 
      status: { $in: ['QUEUED', 'PROCESSING'] } 
    });
    
    if (remainingCount > 0) return; // Wait for other workers/retries

    if (finalCampaign.failedCount > 0 && finalCampaign.acceptedCount > 0) {
      finalCampaign.status = 'PARTIAL_FAILURE';
    } else if (finalCampaign.failedCount > 0 && finalCampaign.acceptedCount === 0) {
      finalCampaign.status = 'FAILED';
    } else {
      finalCampaign.status = 'COMPLETED';
    }
    finalCampaign.completedAt = new Date();
    await finalCampaign.save();

  } catch (err) {
    console.error('Fatal Campaign Error', err);
  }
}

async function getCampaigns(req, res) {
  try {
    const campaigns = await WhatsAppCampaign.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getCampaignById(req, res) {
  try {
    const campaign = await WhatsAppCampaign.findOne({ _id: req.params.id, userId: req.user._id });
    if (!campaign) return res.status(404).json({ success: false, message: 'Not found' });
    
    const logs = await WhatsAppMessageLog.find({ campaignId: campaign._id }).select('status');
    const counts = { QUEUED: 0, PROCESSING: 0, ACCEPTED: 0, SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0, SKIPPED: 0, DELIVERY_UNKNOWN: 0 };
    logs.forEach(l => {
      if (counts[l.status] !== undefined) counts[l.status]++;
    });

    res.json({ success: true, data: campaign, liveCounts: counts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getEligibleCustomers,
  createCampaign,
  getCampaigns,
  getCampaignById,
  processCampaign
};
