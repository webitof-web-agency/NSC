const { body, validationResult } = require("express-validator");

exports.createRoleValidator = [
    body("roleName")
        .trim()
        .notEmpty()
        .withMessage("Role name is required")
        .isLength({ min: 2 })
        .withMessage("Role name must be at least 2 characters")
        .isLength({ max: 255 })
        .withMessage("Role name cannot exceed 255 characters"),

    body("status")
        .optional()
        .isBoolean()
        .withMessage("Status must be a boolean value"),

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
    }
];
