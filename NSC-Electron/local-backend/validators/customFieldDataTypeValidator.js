const { body } = require('express-validator');

exports.createCustomFieldDataTypeValidator = [
  // Type
  body('type')
    .notEmpty()
    .withMessage('Type is required')
    .isIn([
      'text', 'number', 'email', 'date', 'time', 'boolean', 'array', 'object', 'set', 'function',
      'textarea', 'select', 'checkbox', 'radio', 'currency', 'Text Box (Single Line)', 'Text Box (Multi Line)', 'Number', 'Email', 'Date', 'Time',
      'Checkbox', 'Radio Button', 'Dropdown', 'File Upload', 'URL', 'Phone Number', 'Currency',
      'Percentage', 'Decimal', 'Integer', 'Text Area', 'Rich Text Editor', 'Color Picker',
      'Range Slider', 'Toggle Switch', 'Rating', 'Tags', 'JSON Object', 'Array List',
      'Set Collection', 'Function Call'
    ])
    .withMessage('Type must be one of the supported field types'),

  // Description
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
];

exports.updateCustomFieldDataTypeValidator = [
  // Type
  body('type')
    .optional()
    .isIn([
      'text', 'number', 'email', 'date', 'time', 'boolean', 'array', 'object', 'set', 'function',
      'textarea', 'select', 'checkbox', 'radio', 'currency', 'Text Box (Single Line)', 'Text Box (Multi Line)', 'Number', 'Select and Option' ,'Email', 'Date Picker', 'Time',
      'Checkbox', 'Radio Button', 'Dropdown', 'File Upload', 'URL', 'Phone Number', 'Currency',
      'Percentage', 'Decimal', 'Integer', 'Text Area', 'Rich Text Editor', 'Color Picker',
      'Range Slider', 'Toggle Switch', 'Rating', 'Tags', 'JSON Object', 'Array List',
      'Set Collection', 'Function Call'
    ])
    .withMessage('Type must be one of the supported field types'),

  // Description
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),

  // Is Active
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean value'),
];
