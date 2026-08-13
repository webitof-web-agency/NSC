const { body, param, validationResult } = require('express-validator');

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().reduce((acc, error) => {
        acc[error.path] = error.msg;
        return acc;
      }, {})
    });
  }
  next();
};

// Create reminder validator
exports.createReminderValidator = [
  // Basic reminder information
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Reminder name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Reminder name must be between 2 and 100 characters'),

  body('type')
    .notEmpty()
    .withMessage('Reminder type is required')
    .isIn(['automatic', 'manual','automatic_Purchase','manual_purchase'])
    .withMessage('Reminder type must be either automatic or manual or automatic_Purchase or manual_purchase'),

  body('isEnabled')
    .optional()
    .isBoolean()
    .withMessage('isEnabled must be a boolean value'),

  // Email configuration validation
  body('emailConfig.remindTo')
    .optional(),

  body('emailConfig.fromEmail')
    .optional()
    .isEmail()
    .withMessage('From email must be a valid email address'),

  body('emailConfig.cc')
    .optional()
    .isArray()
    .withMessage('CC must be an array')
    .custom((cc) => {
      if (cc && cc.length > 0) {
        return cc.every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      }
      return true;
    })
    .withMessage('All CC emails must be valid email addresses'),

  body('emailConfig.bcc')
    .optional()
    .isArray()
    .withMessage('BCC must be an array')
    .custom((bcc) => {
      if (bcc && bcc.length > 0) {
        return bcc.every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      }
      return true;
    })
    .withMessage('All BCC emails must be valid email addresses'),

  body('emailConfig.subject')
    .notEmpty()
    .withMessage('Email subject is required'),

  body('emailConfig.body')
    .notEmpty()
    .withMessage('Email body is required')
    .isLength({ min: 1 })
    .withMessage('Email body cannot be empty'),

  // Automatic reminder specific validation
  body('remindDays')
    .if(body('type').isIn(['automatic', 'automatic_Purchase']))
    .notEmpty()
    .withMessage('Remind days is required for automatic reminders')
    .isInt({ min: 0 })
    .withMessage('Remind days must be a non-negative integer'),

  body('remindTiming')
    .if(body('type').isIn(['automatic', 'automatic_Purchase']))
    .notEmpty()
    .withMessage('Remind timing is required for automatic reminders')
    .isIn(['before', 'after','duedate'])
    .withMessage('Remind timing must be either before or after'),


  // Manual reminder specific validation
  body('targetInvoice')
    .optional()
    .isMongoId()
    .withMessage('Target invoice must be a valid MongoDB ObjectId'),

  body('targetCustomer')
    .optional()
    .isMongoId()
    .withMessage('Target customer must be a valid MongoDB ObjectId'),

  body('manualReminderData.scheduledDate')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO 8601 date')
    .custom((value) => {
      if (value) {
        const scheduledDate = new Date(value);
        const now = new Date();
        if (scheduledDate <= now) {
          throw new Error('Scheduled date must be in the future');
        }
      }
      return true;
    }),

  body('manualReminderData.customSubject')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Custom subject cannot exceed 200 characters'),

  body('manualReminderData.customBody')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Custom body cannot be empty if provided'),

  handleValidationErrors
];

// Update reminder validator
exports.updateReminderValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid reminder ID'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Reminder name must be between 2 and 100 characters'),

  body('type')
    .optional()
    .isIn(['automatic', 'manual','automatic_Purchase','manual_purchase'])
    .withMessage('Reminder type must be either automatic or manual or automatic_Purchase or manual_purchase'),

  body('isEnabled')
    .optional()
    .isBoolean()
    .withMessage('isEnabled must be a boolean value'),

  // Email configuration validation
  body('emailConfig.remindTo')
    .optional(),

  body('emailConfig.fromEmail')
    .optional()
    .isEmail()
    .withMessage('From email must be a valid email address'),

  body('emailConfig.cc')
    .optional()
    .isArray()
    .withMessage('CC must be an array')
    .custom((cc) => {
      if (cc && cc.length > 0) {
        return cc.every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      }
      return true;
    })
    .withMessage('All CC emails must be valid email addresses'),

  body('emailConfig.bcc')
    .optional()
    .isArray()
    .withMessage('BCC must be an array')
    .custom((bcc) => {
      if (bcc && bcc.length > 0) {
        return bcc.every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      }
      return true;
    })
    .withMessage('All BCC emails must be valid email addresses'),

  body('emailConfig.subject')
    .optional(),

  body('emailConfig.body')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Email body cannot be empty'),

  // Automatic reminder specific validation
  body('remindDays')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Remind days must be a non-negative integer'),

  body('remindTiming')
    .optional()
    .isIn(['before', 'after','duedate'])
    .withMessage('Remind timing must be either before or after'),


  // Manual reminder specific validation
  body('targetInvoice')
    .optional()
    .isMongoId()
    .withMessage('Target invoice must be a valid MongoDB ObjectId'),

  body('targetCustomer')
    .optional()
    .isMongoId()
    .withMessage('Target customer must be a valid MongoDB ObjectId'),

  body('manualReminderData.scheduledDate')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO 8601 date')
    .custom((value) => {
      if (value) {
        const scheduledDate = new Date(value);
        const now = new Date();
        if (scheduledDate <= now) {
          throw new Error('Scheduled date must be in the future');
        }
      }
      return true;
    }),

  body('manualReminderData.customSubject')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Custom subject cannot exceed 200 characters'),

  body('manualReminderData.customBody')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Custom body cannot be empty if provided'),

  handleValidationErrors
];

// Toggle reminder status validator
exports.toggleReminderStatusValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid reminder ID'),

  body('isEnabled')
    .notEmpty()
    .withMessage('isEnabled is required')
    .isBoolean()
    .withMessage('isEnabled must be a boolean value'),

  handleValidationErrors
];

// Send manual reminder validator
exports.sendManualReminderValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid reminder ID'),

  handleValidationErrors
];

// Get reminders by type validator
exports.getRemindersByTypeValidator = [
  param('type')
    .isIn(['automatic', 'manual','automatic_Purchase','manual_purchase'])
    .withMessage('Reminder type must be either automatic or manual or automatic_Purchase or manual_purchase'),

  handleValidationErrors
];

// Get reminder by ID validator
exports.getReminderByIdValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid reminder ID'),

  handleValidationErrors
];

// Delete reminder validator
exports.deleteReminderValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid reminder ID'),

  handleValidationErrors
];
