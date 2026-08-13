const mongoose = require("mongoose");

const invoicePreferencesSchema = new mongoose.Schema(
  {
    // user_id: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "User",
    //   required: true,
    //   unique: true, // one preference per admin/company
    // },

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
