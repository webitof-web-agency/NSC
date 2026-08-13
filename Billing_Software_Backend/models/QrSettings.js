const mongoose = require("mongoose");

const qrSettingsSchema = new mongoose.Schema(
  {
    labelWidthMm: {
      type: Number,
      default: 50,
    },
    labelHeightMm: {
      type: Number,
      default: 25,
    },
    safeMarginMm: {
      type: Number,
      default: 2,
    },
    qrSizeMm: {
      type: Number,
      default: 15,
    },
    showProductName: {
      type: Boolean,
      default: true,
    },
    showBrand: {
      type: Boolean,
      default: true,
    },
    showVariantSize: {
      type: Boolean,
      default: true,
    },
    showVariantColor: {
      type: Boolean,
      default: true,
    },
    fontProductMm: {
      type: Number,
      default: null,
    },
    fontBrandMm: {
      type: Number,
      default: null,
    },
    fontSizeMm: {
      type: Number,
      default: null,
    },
    fontColorMm: {
      type: Number,
      default: null,
    },
    weightProduct: {
      type: Number,
      default: 800,
    },
    weightBrand: {
      type: Number,
      default: 800,
    },
    weightSize: {
      type: Number,
      default: 800,
    },
    weightColor: {
      type: Number,
      default: 800,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QrSettings", qrSettingsSchema);
