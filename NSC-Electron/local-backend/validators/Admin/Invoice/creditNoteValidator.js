const { body, param } = require('express-validator');
const CreditNote = require('@models/CreditNote');
const Invoice = require('@models/Invoice');
const Customer = require('@models/Customer');
const User = require('@models/User');

const createCreditNoteValidator = [
  body('invoiceId')
    .notEmpty().withMessage('Invoice ID is required')
    .isMongoId().withMessage('Invalid Invoice ID')
    .custom(async (value) => {
      const invoice = await Invoice.findById(value);
      if (!invoice) {
        throw new Error('Invoice not found');
      }
      return true;
    }),

  body('creditNoteDate')
    .notEmpty().withMessage('Credit note date is required')
    .isISO8601().withMessage('Invalid date format'),

  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),

  body('items.*.name')
    .notEmpty().withMessage('Item name is required'),

  body('items.*.rate')
    .isNumeric().withMessage('Item rate must be a number')
    .isFloat({ min: 0 }).withMessage('Item rate must be positive'),

  body('items.*.qty')
    .isNumeric().withMessage('Item quantity must be a number')
    .isFloat({ min: 0 }).withMessage('Item quantity must be positive'),

  body('billFrom')
    .notEmpty().withMessage('Bill from is required')
    .isMongoId().withMessage('Invalid Bill From ID')
    .custom(async (value) => {
      const user = await User.findById(value);
      if (!user) {
        throw new Error('Bill From user not found');
      }
      return true;
    }),

  body('billTo')
    .notEmpty().withMessage('Bill to is required')
    .isMongoId().withMessage('Invalid Bill To ID')
    .custom(async (value) => {
      const customer = await Customer.findById(value);
      if (!customer) {
        throw new Error('Bill To customer not found');
      }
      return true;
    }),

  
];

const applyCreditNoteValidator = [
  param('id')
    .isMongoId().withMessage('Invalid Credit Note ID'),

  body('invoiceId')
    .notEmpty().withMessage('Invoice ID is required')
    .isMongoId().withMessage('Invalid Invoice ID')
];

module.exports = {
  createCreditNoteValidator,
  applyCreditNoteValidator
};