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

// Events are only needed until desktop apps have pulled them, so MongoDB expires
// old ones. Apps whose cursor is older than this window re-bootstrap instead.
const RETENTION_DAYS = Number(process.env.SYNC_JOURNAL_RETENTION_DAYS) || 60;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

syncJournalSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_MS / 1000 });

syncJournalSchema.statics.isCursorExpired = function (cursor) {
  if (!mongoose.isValidObjectId(cursor)) return false;
  return new mongoose.Types.ObjectId(cursor).getTimestamp().getTime() < Date.now() - RETENTION_MS;
};

module.exports = mongoose.model('SyncJournal', syncJournalSchema);
