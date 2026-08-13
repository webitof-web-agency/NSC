// validators/customerValidator.js
const { body, validationResult } = require("express-validator");
const fs = require('fs');

exports.createCustomerValidator = [


  body("phone")
    .trim()
    .notEmpty().withMessage("Phone number is required")    // new added line
    .matches(/^[\d\s+-]+$/).withMessage("Please provide a valid phone number"),

  body("status")
    .optional()
    .isIn(['Active', 'Inactive']).withMessage("Status must be either Active or Inactive"),

  body("billingAddress")
    .optional()
    .custom(value => {
      try {
        if (typeof value === 'string') {
          value = JSON.parse(value);
        }
        return typeof value === 'object' && !Array.isArray(value);
      } catch {
        return false;
      }
    }).withMessage("Billing address must be a valid object"),

  body("shippingAddress")
    .optional()
    .custom(value => {
      try {
        if (typeof value === 'string') {
          value = JSON.parse(value);
        }
        return typeof value === 'object' && !Array.isArray(value);
      } catch {
        return false;
      }
    }).withMessage("Shipping address must be a valid object"),

  body("bankDetails")
    .optional()
    .custom(value => {
      try {
        if (typeof value === 'string') {
          value = JSON.parse(value);
        }
        return typeof value === 'object' && !Array.isArray(value);
      } catch {
        return false;
      }
    }).withMessage("Bank details must be a valid object"),


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
        success: false,
        message: 'Validation failed',
        errors: formattedErrors
      });
    }

    // Parse JSON strings for addresses if needed
    ['billingAddress', 'shippingAddress', 'bankDetails'].forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch (err) {
          // Error will be caught by the validator
        }
      }
    });

    next();
  }
];
