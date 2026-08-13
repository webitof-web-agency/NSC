const mongoose = require('mongoose');

const syncConflictSchema = new mongoose.Schema(
  {
    syncId: { type: String, required: true },
    collectionName: { type: String, required: true },
    deviceId: { type: String, required: true },
    operation: { type: String, required: true },
    localVersion: { type: Number, required: true },
    cloudVersion: { type: Number, required: true },
    localPayload: { type: mongoose.Schema.Types.Mixed },
    cloudPayload: { type: mongoose.Schema.Types.Mixed },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolutionNotes: { type: String },
  },
  { timestamps: true }
);

syncConflictSchema.index({ syncId: 1, collectionName: 1 });

module.exports = mongoose.model('SyncConflict', syncConflictSchema);
