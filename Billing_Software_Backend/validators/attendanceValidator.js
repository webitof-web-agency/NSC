const { body, param, validationResult } = require('express-validator');

// Validator for marking attendance (check-in)
exports.markAttendanceValidator = [
  body('staffId')
    .notEmpty()
    .withMessage('Staff ID is required')
    .isMongoId()
    .withMessage('Invalid Staff ID format'),

  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format'),

  body('checkInTime')
    .notEmpty()
    .withMessage('Check-in time is required')
    .isISO8601()
    .withMessage('Invalid check-in time format'),

  body('status')
    .optional()
    .isIn(['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE'])
    .withMessage('Invalid status value'),

  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),

  body('location').optional().trim().isLength({ max: 200 }).withMessage('Location cannot exceed 200 characters'),

  // Middleware to handle validation results
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = {};
      errors.array().forEach((err) => {
        if (!formattedErrors[err.path]) {
          formattedErrors[err.path] = err.msg;
        }
      });

      return res.status(422).json({
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }
    next();
  },
];

// Validator for marking check-out
exports.markCheckOutValidator = [
  param('id').isMongoId().withMessage('Invalid attendance ID format'),

  body('checkOutTime')
    .notEmpty()
    .withMessage('Check-out time is required')
    .isISO8601()
    .withMessage('Invalid check-out time format'),

  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),

  // Middleware to handle validation results
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = {};
      errors.array().forEach((err) => {
        if (!formattedErrors[err.path]) {
          formattedErrors[err.path] = err.msg;
        }
      });

      return res.status(422).json({
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }
    next();
  },
];

// Validator for updating attendance status
exports.updateAttendanceValidator = [
  param('id').isMongoId().withMessage('Invalid attendance ID format'),

  body('status')
    .optional()
    .isIn(['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE'])
    .withMessage('Invalid status value'),

  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),

  body('checkInTime').optional().isISO8601().withMessage('Invalid check-in time format'),

  body('checkOutTime').optional().isISO8601().withMessage('Invalid check-out time format'),

  // Middleware to handle validation results
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = {};
      errors.array().forEach((err) => {
        if (!formattedErrors[err.path]) {
          formattedErrors[err.path] = err.msg;
        }
      });

      return res.status(422).json({
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }
    next();
  },
];
