const WhatsAppMetaTemplate = require('../models/WhatsAppMetaTemplate');
const { getMessageTemplates, createMessageTemplate } = require('../services/metaApiService');

exports.syncMetaTemplates = async (req, res) => {
  try {
    const userId = req.user;
    
    // Fetch from Meta API
    const metaData = await getMessageTemplates(userId);
    const templates = metaData?.data || [];

    // Cache locally
    const operations = templates.map((tmpl) => ({
      updateOne: {
        filter: { userId, metaId: tmpl.id },
        update: {
          $set: {
            name: tmpl.name,
            language: tmpl.language,
            category: tmpl.category,
            status: tmpl.status,
            components: tmpl.components,
            qualityScore: tmpl.quality_score?.score || 'UNKNOWN',
            rejectionReason: tmpl.rejected_reason || '',
          },
        },
        upsert: true,
      },
    }));

    let updated = 0;
    if (operations.length > 0) {
      const result = await WhatsAppMetaTemplate.bulkWrite(operations, { ordered: false });
      updated = (result.modifiedCount || 0) + (result.upsertedCount || 0);
    }

    res.status(200).json({ 
      success: true, 
      count: operations.length,
      diagnostics: {
        metaReturned: templates.length,
        updated,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to sync templates from Meta',
      error: error.message,
      metaCode: error.metaCode,
      metaSubcode: error.metaSubcode,
    });
  }
};
exports.getMetaTemplates = async (req, res) => {
  try {
    const templates = await WhatsAppMetaTemplate.find({ userId: req.user }).sort({ updatedAt: -1 });
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch templates' });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const userId = req.user;
    const { name, category, language, components } = req.body;

    if (!name || !category || !language || !components) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const payload = {
      name,
      category,
      language,
      components,
    };

    const result = await createMessageTemplate(userId, payload);
    
    // Immediately fetch back to sync the status (usually PENDING right after creation)
    await exports.syncMetaTemplates(req, {
      status: () => ({ json: () => {} }),
    });

    res.status(201).json({ success: true, metaId: result.id, message: 'Template submitted to Meta for review' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit template to Meta',
      details: error.details,
    });
  }
};
