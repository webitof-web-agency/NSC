const BarcodeSettings = require("../models/BarcodeSettings");

// CREATE or UPDATE (SINGLE DOC)
exports.upsertSettings = async (req, res) => {
  try {
    const {
      widthMm,
      heightMm,
      labelWidthMm,
      labelHeightMm,
      safeMarginMm,
      format,
      showBarcodeNumber,
      showPrice,
      showSalePrice,
      showBrand,
      showVariantSize,
      showProductName,
      fontProductMm,
      fontBrandMm,
      fontSizeMm,
      fontBarcodeMm,
      fontPriceMm,
      fontSalePriceMm,
      weightProduct,
      weightBrand,
      weightSize,
      weightBarcode,
      weightPrice,
      weightSalePrice,
    } = req.body;

    const settings = await BarcodeSettings.findOneAndUpdate(
      {}, // 👈 always match first (global doc)
      {
        widthMm,
        heightMm,
        labelWidthMm,
        labelHeightMm,
        safeMarginMm,
        format,
        showBarcodeNumber,
        showPrice,
        showSalePrice,
        showBrand,
        showVariantSize,
        showProductName,
        fontProductMm,
        fontBrandMm,
        fontSizeMm,
        fontBarcodeMm,
        fontPriceMm,
        fontSalePriceMm,
        weightProduct,
        weightBrand,
        weightSize,
        weightBarcode,
        weightPrice,
        weightSalePrice,
        isDeleted: false,
      },
      {
        new: true,
        upsert: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "Barcode settings saved successfully",
      data: settings,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// READ
exports.getSettings = async (req, res) => {
  try {
    const settings = await BarcodeSettings.findOne({
      isDeleted: false,
    }).sort({ createdAt: -1 });

    // If no settings exist yet, return defaults (or null, handled by frontend)
    // But since we want defaults, we can just return an empty object or let frontend handle null
    // Ideally, frontend handles null by using its own defaults.

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
