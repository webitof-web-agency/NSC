const { body, param, validationResult } = require('express-validator');
const Product = require('../models/Product');

// Shared validation rules for product
const productValidationRules = () => [
    body('item_type')
        .notEmpty().withMessage('Item type is required')
        .isIn(['Product']).withMessage('Invalid item type'),
    body('code')
        .notEmpty().withMessage('Product code is required'),
    body('hsn_code')
        .notEmpty().withMessage('Product HSN Code is required'),
    body('category')
        .notEmpty().withMessage('Category is required'),
    body('brand')
        .notEmpty().withMessage('Brand is required'),
    body('unit')
        .notEmpty().withMessage('Unit is required'),
    body('tax')
        .notEmpty().withMessage('Tax group is required'),
];

// Reusable error handling logic as a function
const commonErrorHandler = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = {};
        errors.array().forEach((err) => {
            const path = err.path || err.param || 'general';
            formattedErrors[path] = err.msg;
        });
        return res.status(422).json({
            message: 'Validation failed',
            errors: formattedErrors
        });
    }
    next();
};

// Validator for creating a product
const createProductValidator = [
    ...productValidationRules(),
    // Unique checks for code, barcode
    body('code').custom(async (value) => {
        const existing = await Product.findOne({ code: value });
        if (existing) throw new Error('Product code already exists');
        return true;
    }),

    commonErrorHandler
];

// Validator for updating a product
const updateProductValidator = [
    ...productValidationRules(),
    param('id').isMongoId().withMessage('Invalid product ID'),
    body('code').custom(async (value, { req }) => {
        const existing = await Product.findOne({ code: value, _id: { $ne: req.params.id } });
        if (existing) throw new Error('Product code already exists');
        return true;
    }),
    commonErrorHandler
];

module.exports = {
    createProductValidator,
    updateProductValidator,
};
