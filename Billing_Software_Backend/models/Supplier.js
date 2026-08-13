const offlineSyncPlugin = require('../middleware/offlineSync');
const mongoose = require('mongoose');

const accountDetailsSchema = new mongoose.Schema(
  {
    accountHolderName: {
      type: String,
      required: true,
      trim: true,
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    branchName: {
      type: String,
      trim: true,
    },
    accountType: {
      type: String,
      enum: ['savings', 'current'],
      required: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    ifscCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
  },
  { _id: false }
);

const supplierSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Company Details
    company_name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    phone_number: {
      type: String,
      required: true,
      trim: true,
    },

    // Address Details
    company_address: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      required: false,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    pin_code: {
      type: String,
      trim: true,
    },

    // Tax Details
    pan_no: {
      type: String,
      trim: true,
      uppercase: true,
    },
    gst_no: {
      type: String,
      trim: true,
      uppercase: true,
    },

    // Account Details (Multiple Accounts Supported)
    account_details: {
      type: [accountDetailsSchema],
      default: [],
    },

    // Status
    status: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

accountDetailsSchema.plugin(offlineSyncPlugin);

module.exports = mongoose.model('Supplier', supplierSchema);
