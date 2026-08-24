const mongoose = require("mongoose");

const invoicePreferencesSchema = new mongoose.Schema(
  {

    termsAndConditions: {
      type: String,
      default: "",
      trim: true,
    },

    customerNotes: {
      type: String,
      default: "",
      trim: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InvoicePreferences", invoicePreferencesSchema);
