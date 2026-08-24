const mongoose = require("mongoose");

const commissionSystemSettingSchema = new mongoose.Schema({
  commissionPercent: {
    type: Number,
    default: 0   // example: 5 means 5%
  }
}, { timestamps: true });

module.exports = mongoose.model("CommissionSystemSetting", commissionSystemSettingSchema);
