const mongoose = require('mongoose');
const WhatsAppSettings = require('../models/WhatsAppSettings');
const WhatsAppTemplate = require('../models/WhatsAppTemplate');
const WhatsAppMessageLog = require('../models/WhatsAppMessageLog');
const { DEFAULT_TEMPLATE_BODIES } = require('../utils/templateRenderer');
const { normalizePhoneNumber } = require('../utils/phoneFormatter');
const { encryptValue, maskSecret } = require('../utils/credentialCrypto');
const {
  mergeConfig,
  sendTextMessage,
  triggerWhatsAppSend,
} = require('../services/whatsappService');

function toBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

async function getSettings(req, res) {
  try {
    const settings = await WhatsAppSettings.findOne({ userId: req.user }).lean();
    const merged = mergeConfig(settings || null);

    return res.status(200).json({
      success: true,
      data: {
        ...(settings || {}),
        accessToken: settings?.accessToken || '',
        accessTokenMasked: maskSecret(merged.accessToken),
        phoneNumberId: settings?.phoneNumberId || merged.phoneNumberId,
        businessAccountId: settings?.businessAccountId || merged.businessAccountId,
        webhookVerifyToken: settings?.webhookVerifyToken || merged.webhookVerifyToken,
        apiVersion: merged.apiVersion,
        isConfigured:
          Boolean(merged.accessToken) &&
          Boolean(merged.phoneNumberId) &&
          Boolean(merged.businessAccountId) &&
          Boolean(merged.webhookVerifyToken),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function upsertSettings(req, res) {
  try {
    const existing = await WhatsAppSettings.findOne({ userId: req.user }).lean();
    const incomingAccessToken = String(req.body.accessToken || '').trim();
    const encryptedAccessToken = incomingAccessToken
      ? encryptValue(incomingAccessToken)
      : existing?.accessToken || '';

    const payload = {
      isEnabled: toBoolean(req.body.isEnabled, false),
      accessToken: encryptedAccessToken,
      phoneNumberId: String(req.body.phoneNumberId || '').trim(),
      businessAccountId: String(req.body.businessAccountId || '').trim(),
      webhookVerifyToken: String(req.body.webhookVerifyToken || '').trim(),
      apiVersion: String(req.body.apiVersion || process.env.WHATSAPP_API_VERSION || 'v18.0').trim(),
      autoSendOnInvoice: toBoolean(req.body.autoSendOnInvoice, true),
      autoSendOnExchange: toBoolean(req.body.autoSendOnExchange, true),
      autoSendOnQuotation: toBoolean(req.body.autoSendOnQuotation, true),
      testRecipientPhone: String(req.body.testRecipientPhone || '').trim(),
    };

    const settings = await WhatsAppSettings.findOneAndUpdate(
      { userId: req.user },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({
      success: true,
      data: {
        ...settings,
        accessTokenMasked: maskSecret(incomingAccessToken || mergeConfig(settings).accessToken),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function listTemplates(req, res) {
  try {
    const templates = await WhatsAppTemplate.find({ userId: req.user }).sort({ type: 1 }).lean();
    return res.status(200).json({ success: true, data: templates });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function createTemplate(req, res) {
  try {
    const type = String(req.body.type || '').trim();
    if (!['invoice', 'exchange', 'quotation'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid template type' });
    }

    const template = await WhatsAppTemplate.findOneAndUpdate(
      { userId: req.user, type },
      {
        $set: {
          headerText: String(req.body.headerText || '').trim(),
          bodyText: String(req.body.bodyText || DEFAULT_TEMPLATE_BODIES[type]).trim(),
          footerText: String(req.body.footerText || '').trim(),
          includeDocument: toBoolean(req.body.includeDocument, true),
          isActive: toBoolean(req.body.isActive, true),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, data: template });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function updateTemplate(req, res) {
  try {
    const template = await WhatsAppTemplate.findOneAndUpdate(
      { _id: req.params.id, userId: req.user },
      {
        $set: {
          headerText: String(req.body.headerText || '').trim(),
          bodyText: String(req.body.bodyText || '').trim(),
          footerText: String(req.body.footerText || '').trim(),
          includeDocument: toBoolean(req.body.includeDocument, true),
          isActive: toBoolean(req.body.isActive, true),
        },
      },
      { new: true }
    );

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    return res.status(200).json({ success: true, data: template });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function listMessages(req, res) {
  try {
    const query = { userId: req.user };
    if (req.query.status) query.status = req.query.status;
    if (req.query.documentType) query.documentType = req.query.documentType;
    if (req.query.customerId) query.customerId = req.query.customerId;
    if (req.query.dateFrom || req.query.dateTo) {
      query.createdAt = {};
      if (req.query.dateFrom) query.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) query.createdAt.$lte = new Date(req.query.dateTo);
    }

    const messages = await WhatsAppMessageLog.find(query).sort({ createdAt: -1 }).limit(200).lean();
    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getMessageById(req, res) {
  try {
    const message = await WhatsAppMessageLog.findOne({ _id: req.params.id, userId: req.user }).lean();
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message log not found' });
    }

    return res.status(200).json({ success: true, data: message });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getMessageStats(req, res) {
  try {
    const [stats] = await WhatsAppMessageLog.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          sent: { $sum: { $cond: [{ $in: ['$status', ['sent', 'delivered', 'read', 'replied']] }, 1, 0] } },
          delivered: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'read', 'replied']] }, 1, 0] } },
          read: { $sum: { $cond: [{ $in: ['$status', ['read', 'replied']] }, 1, 0] } },
          replied: { $sum: { $cond: [{ $eq: ['$status', 'replied'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: stats || {
        total: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        replied: 0,
        failed: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function sendManual(req, res) {
  try {
    const { documentType, documentId } = req.body;
    if (!documentType || !documentId) {
      return res.status(400).json({ success: false, message: 'documentType and documentId are required' });
    }

    const result = await triggerWhatsAppSend({
      documentType,
      documentId,
      userId: req.user,
      manual: true,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function testSend(req, res) {
  try {
    const settings = await WhatsAppSettings.findOne({ userId: req.user });
    const config = mergeConfig(settings || null);
    const to = String(req.body.phone || settings?.testRecipientPhone || '').trim();

    if (!to) {
      return res.status(400).json({ success: false, message: 'Test recipient phone is required' });
    }

    if (!config.isEnabled) {
      return res.status(400).json({ success: false, message: 'WhatsApp is disabled in settings' });
    }

    if (!config.accessToken || !config.phoneNumberId) {
      return res.status(400).json({ success: false, message: 'WhatsApp credentials are incomplete' });
    }

    const response = await sendTextMessage({
      config,
      phone: normalizePhoneNumber(to),
      text: 'This is a WhatsApp integration test message from NSC Billing Software.',
    });

    await WhatsAppSettings.findOneAndUpdate(
      { userId: req.user },
      { $set: { lastTestedAt: new Date(), testRecipientPhone: to } },
      { upsert: true }
    );

    return res.status(200).json({ success: true, data: response });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getSettings,
  upsertSettings,
  listTemplates,
  createTemplate,
  updateTemplate,
  listMessages,
  getMessageById,
  getMessageStats,
  sendManual,
  testSend,
};
