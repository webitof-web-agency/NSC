const MrpSettings = require("../models/MrpSettings");

// CREATE or UPDATE (single doc)
exports.upsertSettings = async (req, res) => {
  try {
    const { mode, allowManualOverride, allowSaleManualOverride, multiplier, saleMultiplier } = req.body;
    const normalizedMultiplier = Number(multiplier);
    const safeMultiplier = Number.isFinite(normalizedMultiplier)
      ? Math.max(normalizedMultiplier, 0)
      : 0;
    const normalizedSaleMultiplier = Number(saleMultiplier);
    const safeSaleMultiplier = Number.isFinite(normalizedSaleMultiplier)
      ? Math.max(normalizedSaleMultiplier, 0)
      : 0;
    const normalizedMode = typeof mode === "string" ? mode : "manual";

    const settings = await MrpSettings.findOneAndUpdate(
      {},
      {
        mode: normalizedMode,
        allowManualOverride,
        allowSaleManualOverride,
        multiplier: safeMultiplier,
        saleMultiplier: safeSaleMultiplier,
        isDeleted: false,
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "MRP settings saved successfully",
      data: settings,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// READ
exports.getSettings = async (req, res) => {
  try {
    const settings = await MrpSettings.findOne({ isDeleted: false }).sort({
      createdAt: -1,
    });
    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
