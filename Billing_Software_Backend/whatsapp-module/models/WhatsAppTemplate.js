const mongoose = require('mongoose');

const whatsAppTemplateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['invoice', 'exchange', 'quotation'],
      required: true,
    },
    headerText: {
      type: String,
      default: '',
      trim: true,
    },
    bodyText: {
      type: String,
      default: '',
      trim: true,
    },
    footerText: {
      type: String,
      default: '',
      trim: true,
    },
    includeDocument: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

whatsAppTemplateSchema.index({ userId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('WhatsAppTemplate', whatsAppTemplateSchema);
