const { validationResult } = require("express-validator");
const CommissionSystemSetting = require("../models/CommissionSystemSetting");

// UPDATE commission percentage
const updateCommission = async (req, res) => {
  try {
    // VALIDATION
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { percent } = req.body;

    const settings = await CommissionSystemSetting.findOneAndUpdate(
      {},
      { commissionPercent: percent },
      { upsert: true, new: true }
    );

    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to update commission",
      error: err.message,
    });
  }
};

// GET commission percentage
const getCommission = async (req, res) => {
  try {
    const settings = await CommissionSystemSetting.findOne({});

    res.status(200).json({
      success: true,
      settings: settings || { commissionPercent: 0 },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch commission settings",
      error: err.message,
    });
  }
};

module.exports = {
  updateCommission,
  getCommission,
};
