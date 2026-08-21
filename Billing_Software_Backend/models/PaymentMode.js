const mongoose = require('mongoose');
const offlineSyncPlugin = require('../middleware/offlineSync');

const paymentModeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
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

paymentModeSchema.plugin(offlineSyncPlugin);

module.exports = mongoose.model('PaymentMode', paymentModeSchema);
