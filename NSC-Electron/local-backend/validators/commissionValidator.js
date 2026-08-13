const { body } = require("express-validator");

exports.validateCommissionUpdate = [
  body("percent")
    .exists().withMessage("Commission percent is required")
    .notEmpty().withMessage("Commission percent cannot be empty")
    .isNumeric().withMessage("Commission percent must be a number")
    .custom((value) => value >= 0 && value <= 100)
    .withMessage("Commission percent must be between 0 and 100"),
];
