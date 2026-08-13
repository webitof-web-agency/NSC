const { body } = require('express-validator');

const debitNoteValidator = [
  body('purchaseId')
    .notEmpty().withMessage('Purchase ID is required')
    .isMongoId().withMessage('Invalid purchase ID format'),

  body('debitNoteDate')
    .notEmpty().withMessage('Debit note date is required')
    .isISO8601().withMessage('Invalid date format')
    .toDate(),

  body('items')
    .isArray({ min: 1 }).withMessage('At least one return item is required'),



  body('items.*.qty')
    .notEmpty().withMessage('Quantity is required')
    .isNumeric().withMessage('Quantity must be a number')
    .toFloat(),

  body('items.*.rate')
    .notEmpty().withMessage('Rate is required')
    .isNumeric().withMessage('Rate must be a number')
    .toFloat(),

  body('replacementItems')
    .optional()
    .isArray().withMessage('Replacement items must be an array'),

  body('replacementItems.*.qty')
    .optional()
    .notEmpty().withMessage('Replacement quantity is required')
    .isNumeric().withMessage('Replacement quantity must be a number')
    .toFloat(),

  body('replacementItems.*.rate')
    .optional()
    .notEmpty().withMessage('Replacement rate is required')
    .isNumeric().withMessage('Replacement rate must be a number')
    .toFloat(),


  body('userId')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid user ID format'),


  // Optional fields
  body('referenceNo').optional().isString(),
  body('notes').optional().isString(),
  body('termsAndCondition').optional().isString(),
  body('status').optional().isIn(['new', 'pending', 'completed', 'cancelled', 'partially_paid', 'paid', 'return', 'replaced']),
  body('adjustmentType').optional().isIn(['supplier_credit', 'supplier_payable', 'even_exchange'])
];

module.exports = {
  debitNoteValidator
};
