const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    category_name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    category_image: {
      type: String,
    },
    status: {
      type: Boolean,
      default: true,
    },
    defaultUnitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      default: null,
    },
    defaultTaxId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaxGroup",
      default: null,
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true } 
  }
);

categorySchema.virtual('categoryImageUrl').get(function () {
  if (this.category_image) {
    return `${process.env.BASE_URL}/uploads/${this.category_image}`;
  }
  return "";
});
module.exports = mongoose.model('Category', categorySchema);
