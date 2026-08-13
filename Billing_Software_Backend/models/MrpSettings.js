const mongoose = require("mongoose");

const mrpSettingsSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ["manual", "2x", "3x"],
      default: "manual",
    },
    allowManualOverride: {
      type: Boolean,
      default: true,
    },
    allowSaleManualOverride: {
      type: Boolean,
      default: true,
    },
    multiplier: {
      type: Number,
      default: 0,
    },
    saleMultiplier: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MrpSettings", mrpSettingsSchema);
