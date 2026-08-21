const mongoose = require('mongoose');

const whatsAppSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    isEnabled: {
      type: Boolean,
      default: false,
    },
    accessToken: {
      type: String,
      default: '',
      trim: true,
    },
    phoneNumberId: {
      type: String,
      default: '',
      trim: true,
    },
    businessAccountId: {
      type: String,
      default: '',
      trim: true,
    },
    webhookVerifyToken: {
      type: String,
      default: '',
      trim: true,
    },
    appSecret: {
      type: String,
      default: '',
      trim: true,
    },
    apiVersion: {
      type: String,
      default: process.env.WHATSAPP_API_VERSION || 'v25.0',
      trim: true,
    },
    autoSendOnInvoice: {
      type: Boolean,
      default: true,
    },
    autoSendOnExchange: {
      type: Boolean,
      default: true,
    },
    autoSendOnQuotation: {
      type: Boolean,
      default: true,
    },
    testRecipientPhone: {
      type: String,
      default: '',
      trim: true,
    },
    lastTestedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WhatsAppSettings', whatsAppSettingsSchema);
