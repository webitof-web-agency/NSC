const InvoicePreferences = require("../models/invoicePreferencesModuleSettings");

// CREATE or UPDATE (SINGLE DOC)
exports.upsertPreferences = async (req, res) => {
  try {
    const { termsAndConditions, customerNotes } = req.body;

    const pref = await InvoicePreferences.findOneAndUpdate(
      {}, // 👈 always match first (global doc)
      {
        termsAndConditions,
        customerNotes,
        isDeleted: false, // revive if deleted
      },
      {
        new: true,
        upsert: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "Invoice preferences saved successfully",
      data: pref,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// READ
exports.getPreferences = async (req, res) => {
  try {
    const pref = await InvoicePreferences.findOne({
      isDeleted: false,
    }).sort({ createdAt: -1 }); // safety if old docs exist

    res.status(200).json({
      success: true,
      data: pref,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE (Soft delete)
exports.deletePreferences = async (req, res) => {
  try {
    await InvoicePreferences.updateMany(
      {},
      { isDeleted: true }
    );

    res.status(200).json({
      success: true,
      message: "Invoice preferences deleted",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
