const mongoose = require('mongoose');

const whatsAppMessageLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    customerPhone: {
      type: String,
      default: '',
      trim: true,
    },
    customerName: {
      type: String,
      default: '',
      trim: true,
    },
    documentType: {
      type: String,
      enum: ['invoice', 'exchange', 'quotation'],
      required: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    documentNumber: {
      type: String,
      default: '',
      trim: true,
    },
    messageId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    mediaId: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'read', 'failed', 'replied'],
      default: 'queued',
      index: true,
    },
    errorMessage: {
      type: String,
      default: '',
      trim: true,
    },
    renderedMessage: {
      type: String,
      default: '',
    },
    replyText: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      default: 0,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    repliedAt: {
      type: Date,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WhatsAppMessageLog', whatsAppMessageLogSchema);
