const mongoose = require('mongoose');
const offlineSyncPlugin = require('../middleware/offlineSync');


const productSchema = new mongoose.Schema(
  {
    item_type: {
      type: String,
      enum: ["Product"],
      required: true,
      default: "Product",
    },

    name: {
      type: String,
      trim: true,
      default: "",
    },

    code: {
      type: String,
      required: true,
      unique: true,
    },

    hsn_code: {
      type: String,
      trim: true
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },

    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
    },


    tax: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaxGroup",
      required: false, // ✅ Optional for Excel import
    },

    status: {
        type: Boolean,
        default: true
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);


productSchema.plugin(offlineSyncPlugin);

module.exports = mongoose.model("Product", productSchema);
