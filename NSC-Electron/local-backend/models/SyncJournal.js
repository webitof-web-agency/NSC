const mongoose = require('mongoose');

const syncJournalSchema = new mongoose.Schema({
  cursor: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString(),
    unique: true,
    index: true // Efficient chronological pulls
  },
  syncId: {
    type: String,
    required: true,
    index: true
  },
  operation: {
    type: String,
    enum: ['CREATE', 'UPDATE', 'DELETE'],
    required: true
  },
  collectionName: {
    type: String,
    required: true,
    index: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  deviceId: {
    type: String,
    required: false // Null if originated from cloud Web UI
  },
  version: {
    type: Number,
    required: true,
    default: 1
  }
}, { timestamps: true });

// Optional: Add a compound index to support filtering by collection and cursor
syncJournalSchema.index({ collectionName: 1, cursor: 1 });

module.exports = mongoose.model('SyncJournal', syncJournalSchema);
