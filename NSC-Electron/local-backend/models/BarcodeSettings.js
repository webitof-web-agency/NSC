const mongoose = require("mongoose");

const barcodeSettingsSchema = new mongoose.Schema(
  {
    widthMm: {
      type: Number,
      default: 0.35,
    },
    heightMm: {
      type: Number,
      default: 11,
    },
    labelWidthMm: {
      type: Number,
      default: 48,
    },
    labelHeightMm: {
      type: Number,
      default: 23,
    },
    safeMarginMm: {
      type: Number,
      default: 2,
    },
    format: {
      type: String,
      default: "CODE128",
      trim: true,
    },
    showBarcodeNumber: {
      type: Boolean,
      default: true,
    },
    showPrice: {
      type: Boolean,
      default: true,
    },
    showSalePrice: {
      type: Boolean,
      default: false,
    },
    showBrand: {
      type: Boolean,
      default: true,
    },
    showProductName: {
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
    fontBarcodeMm: {
      type: Number,
      default: null,
    },
    fontPriceMm: {
      type: Number,
      default: null,
    },
    fontSalePriceMm: {
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
    weightBarcode: {
      type: Number,
      default: 700,
    },
    weightPrice: {
      type: Number,
      default: 800,
    },
    weightSalePrice: {
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

module.exports = mongoose.model("BarcodeSettings", barcodeSettingsSchema);
