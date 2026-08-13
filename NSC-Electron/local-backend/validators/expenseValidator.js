// validators/Admin/Expense/expenseValidator.js
const { body } = require('express-validator');

const createExpenseValidator = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),

  body('expenseDate')
    .notEmpty().withMessage('Expense date is required')
    .isISO8601().withMessage('Invalid date format'),

  body('paymentStatus')
    .optional()
    .isIn(['PAID', 'CANCELLED', 'PENDING']).withMessage('Invalid payment status'),

  body('description')
    .optional()
    .isString()
];

module.exports = { createExpenseValidator };
