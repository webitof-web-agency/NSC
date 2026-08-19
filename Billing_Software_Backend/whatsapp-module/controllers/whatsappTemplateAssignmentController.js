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
    const { isEnabled, metaTemplateId, metaTemplateName, languageCode, headerMapping, variableMappings } = req.body;

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
