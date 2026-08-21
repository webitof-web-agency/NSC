const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  template: {
    metaTemplateId: { type: String, required: true },
    name: { type: String, required: true },
    language: { type: String, required: true },
    category: { type: String, required: true },
  },
  status: {
    type: String,
    enum: ['DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL_FAILURE', 'FAILED'],
    default: 'DRAFT',
  },
  
  // Counts
  totalSelected: { type: Number, default: 0 },
  totalEligible: { type: Number, default: 0 },
  totalExcluded: { type: Number, default: 0 },
  queuedCount: { type: Number, default: 0 },
  acceptedCount: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  deliveredCount: { type: Number, default: 0 },
  readCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },

  // Mappings
  variableMappings: [
    {
      component: String,
      parameterIndex: Number,
      sourceType: { type: String, enum: ['FIXED', 'VARIABLE'] },
      sourceValue: String,
    }
  ],
  headerMapping: {
    sourceType: { type: String, enum: ['NONE', 'DOCUMENT_PDF', 'IMAGE_URL', 'VIDEO_URL'] },
    sourceValue: String,
  },
  buttonMappings: [
    {
      index: Number,
      sourceType: { type: String, enum: ['FIXED', 'VARIABLE'] },
      sourceValue: String,
    }
  ],

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  startedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  idempotencyKey: {
    type: String,
    sparse: true,
    index: true,
  },
}, { timestamps: true });

schema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('WhatsAppCampaign', schema);
