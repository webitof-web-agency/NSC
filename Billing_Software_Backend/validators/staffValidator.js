const { body, validationResult } = require("express-validator");
const fs = require("fs");

exports.createStaffValidator = [
    // First Name
    body("firstName")
        .trim()
        .notEmpty().withMessage("First name is required")
        .isLength({ min: 2 }).withMessage("First name must be at least 2 characters")
        .isLength({ max: 50 }).withMessage("First name cannot exceed 50 characters"),

    // Last Name (optional)
    body("lastName")
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage("Last name cannot exceed 50 characters"),

    // Email
    body("email")
        .trim()
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Invalid email format"),

    // Phone (optional)
    body("phone")
        .optional()
        .trim()
        .isMobilePhone().withMessage("Invalid phone number"),

    // Gender
    body("gender")
        .optional()
        .isIn(["male", "female", "other"]).withMessage("Gender must be male, female, or other"),

    // Date of Birth
    body("dateOfBirth")
        .optional()
        .isDate().withMessage("Invalid date of birth format (YYYY-MM-DD)"),

    // Password
    body("password")
        .notEmpty().withMessage("Password is required")
        .isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),

    // Address (optional)
    body("address")
        .optional()
        .trim()
        .isLength({ max: 255 }).withMessage("Address cannot exceed 255 characters"),

    // Country, State, City (IDs - must be numeric or ObjectId string)
    body("country")
        .optional()
        .isNumeric().withMessage("Country ID must be a number"),

    body("state")
        .optional()
        .isNumeric().withMessage("State ID must be a number"),

    body("city")
        .optional()
        .isNumeric().withMessage("City ID must be a number"),

    // Postal Code (optional)
    body("postalCode")
        .optional()
        .trim()
        .isLength({ max: 20 }).withMessage("Postal code cannot exceed 20 characters"),

    // Role ID
    body("roleId")
        .notEmpty().withMessage("Role ID is required")
        .isMongoId().withMessage("Invalid Role ID format"),

    // Amount Per Day (optional)
    body("amountPerDay")
        .optional()
        .isFloat({ min: 0 }).withMessage("Amount per day must be 0 or greater"),

    // Middleware to handle validation results & image checks
    (req, res, next) => {
        // File checks if a profile image is uploaded
        if (req.file) {
            const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
            if (!allowedTypes.includes(req.file.mimetype)) {
                fs.unlinkSync(req.file.path);
                return res.status(422).json({
                    message: "Validation failed",
                    errors: { profileImage: "Only JPEG and PNG images are allowed" }
                });
            }

            if (req.file.size > 2 * 1024 * 1024) {
                fs.unlinkSync(req.file.path);
                return res.status(422).json({
                    message: "Validation failed",
                    errors: { profileImage: "Image size must be less than 2MB" }
                });
            }
        }

        // Handle field validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path);
            }

            const formattedErrors = {};
            errors.array().forEach((err) => {
                if (!formattedErrors[err.path]) {
                    formattedErrors[err.path] = err.msg;
                }
            });

            return res.status(422).json({
                message: "Validation failed",
                errors: formattedErrors
            });
        }

        next();
    }
];
