const mongoose = require('mongoose');
const offlineSyncPlugin = require('../middleware/offlineSync');

const brandSchema = new mongoose.Schema(
  {
    brand_name: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
      trim: true
    },
    brand_image: {
      type: String,
    },
    hsn_code: {
      type: String,
      trim: true
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

brandSchema.virtual('brandImageUrl').get(function () {
  if (this.brand_image) {
    return `${process.env.BASE_URL}/uploads/${this.brand_image}`;
  }
  return "";
});
brandSchema.plugin(offlineSyncPlugin);

module.exports = mongoose.model('Brand', brandSchema);
