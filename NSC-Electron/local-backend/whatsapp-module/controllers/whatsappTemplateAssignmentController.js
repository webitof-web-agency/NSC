const WhatsAppTemplateAssignment = require('../models/WhatsAppTemplateAssignment');
const WhatsAppMetaTemplate = require('../models/WhatsAppMetaTemplate');

const BODY_VARIABLES = {
  INVOICE: new Set(['customerName', 'customerPhone', 'documentNumber', 'amount', 'date', 'companyName']),
  QUOTATION: new Set(['customerName', 'documentNumber', 'amount', 'date', 'companyName']),
  EXCHANGE: new Set(['customerName', 'documentNumber', 'amount', 'date', 'companyName']),
  TEST_MESSAGE: new Set(['companyName']),
  ADVERTISEMENT: new Set(['customerName', 'companyName']),
  PAYMENT_REMINDER: new Set(['customerName', 'documentNumber', 'amount', 'companyName']),
};

const PUBLIC_SHARE_BUTTONS = {
  INVOICE: { sourceValue: 'publicShareId', label: 'Invoice Public Share ID' },
  QUOTATION: { sourceValue: 'quotationPublicShareId', label: 'Quotation Public Share ID' },
  EXCHANGE: { sourceValue: 'exchangePublicShareId', label: 'Exchange Public Share ID' },
};

const getPlaceholderIndexes = (text) => Array.from(
  new Set(Array.from(String(text || '').matchAll(/\{\{(\d+)\}\}/g), (match) => Number(match[1]))),
).sort((left, right) => left - right);

const getRequiredMappings = (metaTemplate) => {
  const required = [];

  for (const component of metaTemplate?.components || []) {
    if (component.type === 'BODY' || (component.type === 'HEADER' && component.format === 'TEXT')) {
      for (const parameterIndex of getPlaceholderIndexes(component.text)) {
        required.push({ component: component.type, parameterIndex });
      }
    }

    if (component.type === 'BUTTONS') {
      for (const [buttonIndex, button] of (component.buttons || []).entries()) {
        if (button.type !== 'URL') continue;
        for (const parameterIndex of getPlaceholderIndexes(button.url)) {
          required.push({ component: 'BUTTONS', parameterIndex, buttonIndex });
        }
      }
    }
  }

  return required;
};

const getMappingLabel = (mapping) => (
  mapping.component === 'BUTTONS'
    ? `BUTTON ${mapping.buttonIndex ?? 0} {{${mapping.parameterIndex}}}`
    : `${mapping.component} {{${mapping.parameterIndex}}}`
);

const getAssignmentMappingError = (messageType, metaTemplate, variableMappings) => {
  const normalizedType = String(messageType || '').toUpperCase();
  const mappings = Array.isArray(variableMappings) ? variableMappings : [];
  const allowedBodyVariables = BODY_VARIABLES[normalizedType] || new Set();
  const requiredButton = PUBLIC_SHARE_BUTTONS[normalizedType];

  for (const mapping of mappings) {
    if (!String(mapping.sourceValue || '').trim()) {
      return `${getMappingLabel(mapping)} requires a mapping before saving.`;
    }
    if (
      mapping.component === 'BUTTONS'
      && (
        !requiredButton
        || mapping.sourceType !== 'VARIABLE'
        || mapping.sourceValue !== requiredButton.sourceValue
      )
    ) {
      return `${getMappingLabel(mapping)} must map to ${requiredButton?.label || 'a valid public share ID'}.`;
    }
    if (
      ['BODY', 'HEADER'].includes(mapping.component)
      && mapping.sourceType === 'VARIABLE'
      && !allowedBodyVariables.has(mapping.sourceValue)
    ) {
      return `${getMappingLabel(mapping)} has an invalid ${normalizedType} data source.`;
    }
  }

  for (const required of getRequiredMappings(metaTemplate)) {
    const mapping = mappings.find((candidate) => (
      candidate.component === required.component
      && Number(candidate.parameterIndex) === required.parameterIndex
      && (required.component !== 'BUTTONS' || Number(candidate.buttonIndex || 0) === required.buttonIndex)
    ));

    if (!mapping || !String(mapping.sourceValue || '').trim()) {
      return `${getMappingLabel(required)} requires a mapping before saving.`;
    }

    if (required.component === 'BUTTONS') {
      if (
        !requiredButton
        || mapping.sourceType !== 'VARIABLE'
        || mapping.sourceValue !== requiredButton.sourceValue
      ) {
        return `${getMappingLabel(required)} must map to ${requiredButton?.label || 'a valid public share ID'}.`;
      }
      continue;
    }

    if (mapping.sourceType === 'VARIABLE' && !allowedBodyVariables.has(mapping.sourceValue)) {
      return `${getMappingLabel(required)} has an invalid ${normalizedType} data source.`;
    }
  }

  return null;
};

exports.getAssignmentMappingError = getAssignmentMappingError;

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

    const metaTemplate = await WhatsAppMetaTemplate.findOne({
      _id: metaTemplateId,
      userId: req.user,
    }).lean();

    if (!metaTemplate) {
      validationError = 'Selected Meta template was not found for this account.';
    } else {
      validationError = getAssignmentMappingError(messageType, metaTemplate, variableMappings);
    }

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
      if (req.file?.path) {
        const fs = require('fs');
        try { fs.unlinkSync(req.file.path); } catch(e) {}
      }
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
