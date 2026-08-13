// validators/deliveryChallanValidator.js
const { body, param } = require('express-validator');
const DeliveryChallan = require('@models/DeliveryChallan');
const Invoice = require('@models/Invoice');
const Customer = require('@models/Customer');
const User = require('@models/User');

const createDeliveryChallanValidator = [
  body('challanDate')
    .notEmpty().withMessage('Challan date is required')
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



];

const updateDeliveryStatusValidator = [
  param('id')
    .isMongoId().withMessage('Invalid Delivery Challan ID'),

  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['DRAFT', 'SENT', 'DELIVERED', 'CANCELLED', 'PARTIALLY_DELIVERED'])
    .withMessage('Invalid status'),

  body('receivedBy')
    .if(body('status').equals('DELIVERED'))
    .notEmpty().withMessage('Received by is required for delivered status')
    .isString().withMessage('Received by must be a string'),

  body('receivedDate')
    .if(body('status').equals('DELIVERED'))
    .notEmpty().withMessage('Received date is required for delivered status')
    .isISO8601().withMessage('Invalid date format')
];

module.exports = {
  createDeliveryChallanValidator,
  updateDeliveryStatusValidator
};
