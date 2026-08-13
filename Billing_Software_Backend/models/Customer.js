const offlineSyncPlugin = require('../middleware/offlineSync');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: ''
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: {
        validator: function (v) {
          return /^[\d\s+-]+$/.test(v);
        },
        message: props => `${props.value} is not a valid phone number`
      }
    },

    website: {
      type: String,
      trim: true,
      default: ''
    },

    notes: {
      type: String,
      trim: true,
      default: ''
    },

    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    },

    billingAddress: {
      name: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      pincode: String,
      country: String
    },

    shippingAddress: {
      name: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      pincode: String,
      country: String
    },

    bankDetails: {
      bankName: String,
      branch: String,
      accountHolderName: String,
      accountNumber: String,
      IFSC: {
        type: String,
        uppercase: true
      }
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    portalEnabled: {
      type: Boolean,
      default: true
    },

    portalPassword: {
      type: String,
      default: ''
    },

    portalPasswordChanged: {
      type: Boolean,
      default: false
    },

    portalLastLoginAt: {
      type: Date,
      default: null
    },

    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

customerSchema.methods.matchPortalPassword = async function (enteredPassword) {
  if (!this.portalPassword) return false;
  return bcrypt.compare(String(enteredPassword || ''), this.portalPassword);
};

customerSchema.plugin(offlineSyncPlugin);

module.exports = mongoose.model('Customer', customerSchema);
