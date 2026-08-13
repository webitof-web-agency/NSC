const { body, validationResult } = require("express-validator");
const mongoose = require('mongoose');
const Supplier = require("@models/Supplier");
const User = require("@models/User");

// Validation middleware
// exports.createSupplierValidator = [
//     body("supplier_name")
//         .trim()
//         .notEmpty()
//         .withMessage("Supplier name is required")
//         .isLength({ min: 2 })
//         .withMessage("Supplier name must be at least 2 characters")
//         .isLength({ max: 50 })
//         .withMessage("Supplier name cannot exceed 50 characters"),

//     body("supplier_email")
//         .trim()
//         .notEmpty()
//         .withMessage("Supplier email is required")
//         .isEmail()
//         .withMessage("Invalid email address")
//         .custom(async (value) => {
//             const existingUser = await User.findOne({ email: value });
//             if (existingUser) {
//                 throw new Error("Supplier email already exists");
//             }
//             return true;
//         }),
    
//     body("supplier_phone")
//         .trim()
//         .notEmpty()
//         .withMessage("Supplier phone is required")
//         .withMessage("Invalid phone number"),

//     body("balance")
//         .trim()
//         .optional()
//         .isNumeric()
//         .withMessage("Balance must be a valid number")
//         .custom((value, { req }) => {
//             if (value == 0) {
//                 req.body.balance_type = null;
//             }
//             return true;
//         }),
        
//     body("balance_type")
//         .trim()
//         .optional()
//         .custom((value, { req }) => {
//             if (req.body.balance && req.body.balance != 0) {
//                 if (!['credit', 'debit'].includes(value)) {
//                     throw new Error("Balance type must be either 'credit' or 'debit'");
//                 }
//             }
//             return true;
//         }),
        
//     body("password")
//         .optional()
//         .isLength({ min: 6 })
//         .withMessage("Password must be at least 6 characters long"),

//     (req, res, next) => {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             const formattedErrors = {};
//             errors.array().forEach((err) => {
//                 if(!formattedErrors[err.path]){
//                     formattedErrors[err.path] = err.msg;
//                 }
//             })
//             return res.status(422).json({ 
//                 'message': 'Validation failed',
//                 'errors': formattedErrors
//              });
//         }
//         next();
//     },
// ];



// ===============================
// CREATE SUPPLIER VALIDATOR
// ===============================
exports.createSupplierValidator = [

    // -------------------------------
    // Company Details
    // -------------------------------
    body("company_name")
        .trim()
        .notEmpty()
        .withMessage("Company name is required")
        .isLength({ min: 2 })
        .withMessage("Company name must be at least 2 characters")
        .isLength({ max: 100 })
        .withMessage("Company name cannot exceed 100 characters"),

    body("email")
        .optional({ checkFalsy: true }) // ✅ Skip validation if empty string
        .trim()
        .isEmail()
        .withMessage("Invalid email address")
        .custom(async (value) => {
            if (value) { // Only check uniqueness if email is provided
                const existingUser = await User.findOne({ email: value });
                if (existingUser) {
                    throw new Error("Email already exists");
                }
            }
            return true;
        }),

    body("phone_number")
        .trim()
        .notEmpty()
        .withMessage("Phone number is required")
        .isLength({ min: 10, max: 15 })
        .withMessage("Invalid phone number"),

    // -------------------------------
    // Address Details
    // -------------------------------
    body("company_address")
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage("Company address cannot exceed 255 characters"),

    body("city")
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage("City name cannot exceed 50 characters"),

    body("state")
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage("State name cannot exceed 50 characters"),

    body("pin_code")
        .optional()
        .trim()
        .isLength({ min: 4, max: 10 })
        .withMessage("Invalid pin code"),

    // -------------------------------
    // Tax Details
    // -------------------------------
    body("pan_no")
        .optional()
        .trim()
        .isLength({ min: 10, max: 10 })
        .withMessage("PAN number must be exactly 10 characters"),

    body("gst_no")
        .optional()
        .trim()
        .isLength({ min: 15, max: 15 })
        .withMessage("GST number must be exactly 15 characters"),

    // -------------------------------
    // Account Details (Array)
    // -------------------------------
    body("account_details")
    .optional()
    .custom((value, { req }) => {
        if (typeof value === "string") {
        try {
            req.body.account_details = JSON.parse(value);
        } catch (err) {
            throw new Error("Invalid account details format");
        }
        }

        if (!Array.isArray(req.body.account_details)) {
        throw new Error("Account details must be an array");
        }

        return true;
    }),

    body("account_details.*.accountHolderName")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Account holder name is required"),

    body("account_details.*.bankName")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Bank name is required"),

    body("account_details.*.branchName")
        .optional()
        .trim(),

    body("account_details.*.accountType")
        .optional()
        .isIn(["savings", "current"])
        .withMessage("Account type must be savings or current"),

    body("account_details.*.accountNumber")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Account number is required"),

    body("account_details.*.ifscCode")
        .optional()
        .trim()
        .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
        .withMessage("Invalid IFSC code"),

    // -------------------------------
    // Balance Details
    // -------------------------------
    body("balance")
        .optional()
        .isNumeric()
        .withMessage("Balance must be a valid number")
        .custom((value, { req }) => {
            if (Number(value) === 0) {
                req.body.balance_type = null;
            }
            return true;
        }),

    body("balance_type")
        .optional()
        .custom((value, { req }) => {
            if (req.body.balance && Number(req.body.balance) !== 0) {
                if (!["credit", "debit"].includes(value)) {
                    throw new Error(
                        "Balance type must be either 'credit' or 'debit'"
                    );
                }
            }
            return true;
        }),

    // -------------------------------
    // User Password (Optional)
    // -------------------------------
    body("password")
        .optional()
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters long"),

    // -------------------------------
    // FINAL VALIDATION HANDLER
    // -------------------------------
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
                message: "Validation failed",
                errors: formattedErrors,
            });
        }
        next();
    },
];
