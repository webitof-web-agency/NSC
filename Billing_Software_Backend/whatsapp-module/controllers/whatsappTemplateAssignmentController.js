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

    let validationError = null;

    if (req.file && headerMapping) {
      // Validate image contents (magic bytes)
      const fs = require('fs');
      const path = require('path');
      const buffer = fs.readFileSync(req.file.path, { length: 4 });
      const hex = buffer.toString('hex');
      
      const isJPEG = hex.startsWith('ffd8');
      const isPNG = hex.startsWith('89504e47');
      
      if (!isJPEG && !isPNG) {
        fs.unlinkSync(req.file.path); // remove invalid file
        validationError = 'Uploaded file is not a valid JPEG or PNG image.';
      } else {
        const baseUrl = process.env.PUBLIC_BACKEND_URL || process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        headerMapping.value = `${baseUrl}/${req.file.path.replace(/\\/g, '/')}`;
      }
    }

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    // Find existing to know if we should clean up old image
    const oldAssignment = await WhatsAppTemplateAssignment.findOne({ userId: req.user, messageType });

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

    // Clean up old image if it was replaced and it's in the generic uploads/ folder (not company/ or products/)
    if (req.file && oldAssignment && oldAssignment.headerMapping?.value) {
      const oldUrl = oldAssignment.headerMapping.value;
      if (oldUrl.includes('/uploads/') && !oldUrl.includes('/uploads/company/') && !oldUrl.includes('/uploads/products/')) {
        const fs = require('fs');
        const path = require('path');
        const fileName = oldUrl.split('/').pop();
        if (fileName && /^[0-9a-zA-Z._-]+$/.test(fileName)) { // basic path traversal prevention
          const oldFilePath = path.join(process.cwd(), 'uploads', fileName);
          if (fs.existsSync(oldFilePath)) {
            try { fs.unlinkSync(oldFilePath); } catch(e) { console.error('Failed to cleanup old assignment image', e); }
          }
        }
      }
    }

    res.status(200).json({ success: true, data: assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update assignment' });
  }
};
