// middleware/offlineSync.js
// Mongoose plugin — adds _localId, _createdOffline, _syncedFromOfflineAt fields
// to Atlas models so offline-synced records can be deduplicated by _localId

'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Add this plugin to any Atlas model that receives synced records from the desktop app.
 * Usage: schema.plugin(offlineSyncPlugin)
 */
function offlineSyncPlugin(schema) {
  schema.add({
    _localId: {
      type: String,
      default: null,
      index: true,
      sparse: true,  // Only index docs that have this field set
    },

    // ── Phase 3: True Local-First Identity ──
    syncId: {
      type: String,
      default: () => uuidv4(),
      index: true,
      unique: true,
      sparse: true, // sparse because existing documents won't have it until migration runs
    },
    version: {
      type: Number,
      default: 1,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // ────────────────────────────────────────

    // Flag: was this record created offline and synced here?
    _createdOffline: {
      type: Boolean,
      default: false,
    },

    // When was it synced from the offline device?
    _syncedFromOfflineAt: {
      type: Date,
      default: null,
    },
  });

  // Auto-generate syncId for records created directly on Atlas (via Web UI)
  schema.pre('save', function(next) {
    if (!this.syncId) {
      this.syncId = uuidv4();
    }
    next();
  });
}

module.exports = offlineSyncPlugin;
