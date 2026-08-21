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
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppCampaign',
      default: null,
      index: true,
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
      enum: ['QUEUED', 'PROCESSING', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'REPLIED', 'SKIPPED', 'DELIVERY_UNKNOWN'],
      default: 'QUEUED',
      index: true,
    },
    errorMessage: {
      type: String,
      default: '',
      trim: true,
    },
    lastErrorCode: {
      type: String,
      default: '',
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
    processingBy: {
      type: String,
      default: null,
    },
    processingStartedAt: {
      type: Date,
      default: null,
    },
    processingLeaseUntil: {
      type: Date,
      default: null,
    },
    requestStartedAt: {
      type: Date,
      default: null,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    nextRetryAt: {
      type: Date,
      default: null,
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
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

whatsAppMessageLogSchema.index(
  { campaignId: 1, customerPhone: 1 },
  { 
    unique: true, 
    partialFilterExpression: { campaignId: { $exists: true, $ne: null } } 
  }
);

module.exports = mongoose.model('WhatsAppMessageLog', whatsAppMessageLogSchema);
