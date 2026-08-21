const QrSettings = require("../models/QrSettings");

// CREATE or UPDATE (SINGLE DOC)
exports.upsertSettings = async (req, res) => {
  try {
    const {
      labelWidthMm,
      labelHeightMm,
      safeMarginMm,
      qrSizeMm,
      showProductName,
      showBrand,
      showVariantSize,
      showVariantColor,
      fontProductMm,
      fontBrandMm,
      fontSizeMm,
      fontColorMm,
      weightProduct,
      weightBrand,
      weightSize,
      weightColor,
    } = req.body;

    const settings = await QrSettings.findOneAndUpdate(
      {}, // 👈 always match first (global doc)
      {
        labelWidthMm,
        labelHeightMm,
        safeMarginMm,
        qrSizeMm,
        showProductName,
        showBrand,
        showVariantSize,
        showVariantColor,
        fontProductMm,
        fontBrandMm,
        fontSizeMm,
        fontColorMm,
        weightProduct,
        weightBrand,
        weightSize,
        weightColor,
        isDeleted: false,
      },
      {
        new: true,
        upsert: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "QR settings saved successfully",
      data: settings,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// READ
exports.getSettings = async (req, res) => {
  try {
    const settings = await QrSettings.findOne({
      isDeleted: false,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
