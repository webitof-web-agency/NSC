const WhatsAppTemplateAssignment = require('../models/WhatsAppTemplateAssignment');

exports.getAssignments = async (req, res) => {
  try {
    const assignments = await WhatsAppTemplateAssignment.find({ userId: req.user })
      .populate('metaTemplateId')
      .lean();
      
    res.status(200).json({ success: true, data: assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch assignments' });
  }
};

exports.getAssignmentByType = async (req, res) => {
  try {
    const { messageType } = req.params;
    const assignment = await WhatsAppTemplateAssignment.findOne({ userId: req.user, messageType })
      .populate('metaTemplateId')
      .lean();
      
    res.status(200).json({ success: true, data: assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch assignment' });
  }
};

exports.upsertAssignment = async (req, res) => {
  try {
    const { messageType } = req.params;
    let { isEnabled, metaTemplateId, metaTemplateName, languageCode, headerMapping, variableMappings } = req.body;

    if (typeof headerMapping === 'string') {
      try { headerMapping = JSON.parse(headerMapping); } catch(e) {}
    }
    if (typeof variableMappings === 'string') {
      try { variableMappings = JSON.parse(variableMappings); } catch(e) {}
    }

    if (req.file && headerMapping) {
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      headerMapping.value = `${baseUrl}/${req.file.path.replace(/\\/g, '/')}`;
    }

    const assignment = await WhatsAppTemplateAssignment.findOneAndUpdate(
      { userId: req.user, messageType },
      {
        $set: {
          isEnabled,
          metaTemplateId,
          metaTemplateName,
          languageCode,
          headerMapping,
          variableMappings,
        },
      },
      { new: true, upsert: true }
    ).populate('metaTemplateId');

    res.status(200).json({ success: true, data: assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update assignment' });
  }
};
