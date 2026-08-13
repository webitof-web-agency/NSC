const { body } = require('express-validator');

exports.createCustomFieldValidator = [
  // Label Name
  body('labelName')
    .notEmpty()
    .withMessage('Label name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Label name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Label name can only contain letters, numbers, spaces, hyphens, and underscores'),

  // Data Type
  body('dataType')
    .notEmpty()
    .withMessage('Data type is required')
    .isIn(['text', 'number', 'email', 'date', 'boolean', 'array'])
    .withMessage('Data type must be one of: text, number, email, date, boolean, array'),

  // Input Format
  body('inputFormat')
    .optional()
    .isIn(['text', 'number', 'email', 'date', 'textarea', 'select', 'checkbox', 'radio', 'numbers-only', 'alphanumeric', 'currency', 'alphabets-without-spaces'])
    .withMessage('Input format must be one of: text, number, email, date, textarea, select, checkbox, radio, numbers-only, alphanumeric, currency, alphabets-without-spaces'),

  // Help Text
  body('helpText')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Help text must not exceed 500 characters'),

  // Default Value
  body('defaultValue')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Default value must not exceed 1000 characters'),

  // Is Mandatory
  body('isMandatory')
    .optional()
    .isBoolean()
    .withMessage('Is mandatory must be a boolean value'),

  // Options (required for select and radio input formats)
  body('options')
    .optional()
    .isArray()
    .withMessage('Options must be an array')
    .custom((value, { req }) => {
      if (req.body.inputFormat === 'select' || req.body.inputFormat === 'radio') {
        if (!value || value.length === 0) {
          throw new Error('Options are required for select and radio input formats');
        }
        if (value.length > 50) {
          throw new Error('Maximum 50 options allowed');
        }
        // Validate each option
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] !== 'string' || value[i].trim().length === 0) {
            throw new Error(`Option ${i + 1} must be a non-empty string`);
          }
          if (value[i].length > 100) {
            throw new Error(`Option ${i + 1} must not exceed 100 characters`);
          }
        }
      }
      return true;
    }),
];

exports.updateCustomFieldValidator = [
  // Label Name
  body('labelName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Label name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Label name can only contain letters, numbers, spaces, hyphens, and underscores'),

  // Data Type
  body('dataType')
    .optional()
    .isIn(['text', 'number', 'email', 'date', 'boolean', 'array'])
    .withMessage('Data type must be one of: text, number, email, date, boolean, array'),

  // Input Format
  body('inputFormat')
    .optional()
    .isIn(['text', 'number', 'email', 'date', 'textarea', 'select', 'checkbox', 'radio', 'numbers-only', 'alphanumeric', 'currency', 'alphabets-without-spaces'])
    .withMessage('Input format must be one of: text, number, email, date, textarea, select, checkbox, radio, numbers-only, alphanumeric, currency, alphabets-without-spaces'),

  // Help Text
  body('helpText')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Help text must not exceed 500 characters'),

  // Default Value
  body('defaultValue')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Default value must not exceed 1000 characters'),

  // Is Mandatory
  body('isMandatory')
    .optional()
    .isBoolean()
    .withMessage('Is mandatory must be a boolean value'),

  // Is Active
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean value'),

  // Options (required for select and radio input formats)
  body('options')
    .optional()
    .isArray()
    .withMessage('Options must be an array')
    .custom((value, { req }) => {
      if (req.body.inputFormat === 'select' || req.body.inputFormat === 'radio') {
        if (!value || value.length === 0) {
          throw new Error('Options are required for select and radio input formats');
        }
        if (value.length > 50) {
          throw new Error('Maximum 50 options allowed');
        }
        // Validate each option
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] !== 'string' || value[i].trim().length === 0) {
            throw new Error(`Option ${i + 1} must be a non-empty string`);
          }
          if (value[i].length > 100) {
            throw new Error(`Option ${i + 1} must not exceed 100 characters`);
          }
        }
      }
      return true;
    }),
];
