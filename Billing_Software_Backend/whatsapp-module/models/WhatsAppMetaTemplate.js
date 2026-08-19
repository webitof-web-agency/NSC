const mongoose = require('mongoose');

const whatsAppMetaTemplateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    metaId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    language: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: 'PENDING',
    },
    qualityScore: {
      type: String,
      default: 'UNKNOWN',
    },
    components: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    rejectionReason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

whatsAppMetaTemplateSchema.index({ userId: 1, metaId: 1 }, { unique: true });

module.exports = mongoose.model('WhatsAppMetaTemplate', whatsAppMetaTemplateSchema);
