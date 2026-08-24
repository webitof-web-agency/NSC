// local-backend/middleware/offlineSync.js
// Mongoose plugin that adds _localId + _syncStatus fields to all offline-capable models
// _localId: UUID generated at creation — used as dedup key when syncing to Atlas
// _syncStatus: tracks whether this document has been pushed to Atlas

'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Mongoose plugin — add to any model that needs offline sync support
 * Usage: schema.plugin(offlineSyncPlugin)
 */
function offlineSyncPlugin(schema) {
  schema.add({
    // Unique local identifier — used as idempotency key for Atlas sync
    _localId: {
      type: String,
      default: () => uuidv4(),
      index: true,
    },

    // ── Phase 3: True Local-First Identity ──
    syncId: {
      type: String,
      default: () => uuidv4(),
      index: true,
      unique: true,
      sparse: true, // Sparse to avoid unique constraint errors before migration
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

    // Sync tracking
    _syncStatus: {
      synced: {
        type: Boolean,
        default: false,
        index: true,
      },
      syncedAt: {
        type: Date,
        default: null,
      },
      syncError: {
        type: String,
        default: null,
      },
      attemptCount: {
        type: Number,
        default: 0,
      },
    },

    // Flag to identify offline-created records
    _createdOffline: {
      type: Boolean,
      default: true,
    },
  });

  // Auto-generate IDs if not set
  schema.pre('save', function(next) {
    if (!this._localId) {
      this._localId = uuidv4();
    }
    if (!this.syncId) {
      this.syncId = uuidv4();
    }
    next();
  });

  // Automatically queue an Outbox event when a document is saved locally
  // (unless $ignoreOutbox is set, which happens during cloud pull apply)
  schema.post('save', async function(doc, next) {
    if (doc.$ignoreOutbox) return next();

    try {
      const mongoose = require('mongoose');
      const Outbox = mongoose.models.Outbox || require('../models/Outbox');
      
      const operation = doc.isNew ? 'CREATE' : 'UPDATE'; // Note: isNew is false in post-save, but Mongoose retains some state? Wait, actually in post('save'), doc.isNew is always false. But Mongoose provides doc.$isNew if we check it in pre-save.
      // A safer way is to check if it has a version === 1. Or we can just use UPDATE for everything on the cloud side, which we already made idempotent (upsert).
      
      const outboxEvent = new Outbox({
        eventId: uuidv4(),
        syncId: doc.syncId,
        operation: doc.deletedAt ? 'DELETE' : 'UPDATE', // We treat all saves as UPSERTS (UPDATE) in our idempotent cloud push, unless deleted.
        collectionName: doc.constructor.collection.name,
        payload: doc.toObject(),
        version: doc.version || 1,
      });

      // If there's an active session, use it
      const session = doc.$session();
      if (session) {
        await outboxEvent.save({ session });
      } else {
        await outboxEvent.save();
      }

      // Phase 17: Automatically scan for uploaded files and queue them in FileOutbox
      const FileOutbox = mongoose.models.FileOutbox || require('../models/FileOutbox');
      const filePaths = extractFilePaths(doc.toObject());
      for (const filePath of filePaths) {
        const fileOutboxData = { filePath, status: 'PENDING', attempts: 0, error: null };
        if (session) {
          await FileOutbox.findOneAndUpdate({ filePath }, { $set: fileOutboxData }, { upsert: true, session });
        } else {
          await FileOutbox.findOneAndUpdate({ filePath }, { $set: fileOutboxData }, { upsert: true });
        }
      }

      next();
    } catch (err) {
      console.error('Failed to auto-generate Outbox event:', err);
      next(err);
    }
  });

  // Automatically queue an Outbox event when a document is updated via findOneAndUpdate
  schema.post('findOneAndUpdate', async function(doc, next) {
    if (this.options.$ignoreOutbox || (doc && doc.$ignoreOutbox)) return next();
    
    try {
      if (!doc) return next();

      let latestDoc = doc;
      if (!this.options.new) {
        latestDoc = await this.model.findOne(this.getQuery()).session(this.options.session).lean();
      } else {
        if (typeof latestDoc.toObject === 'function') {
          latestDoc = latestDoc.toObject();
        }
      }
      
      if (!latestDoc) return next();

      const mongoose = require('mongoose');
      const Outbox = mongoose.models.Outbox || require('../models/Outbox');
      
      const outboxEvent = new Outbox({
        eventId: uuidv4(),
        syncId: latestDoc.syncId,
        operation: latestDoc.deletedAt ? 'DELETE' : 'UPDATE',
        collectionName: this.model.collection.name,
        payload: latestDoc,
        version: latestDoc.version || 1,
      });

      if (this.options.session) {
        await outboxEvent.save({ session: this.options.session });
      } else {
        await outboxEvent.save();
      }

      // Phase 17: Automatically scan for uploaded files and queue them in FileOutbox
      const FileOutbox = mongoose.models.FileOutbox || require('../models/FileOutbox');
      const filePaths = extractFilePaths(latestDoc);
      for (const filePath of filePaths) {
        // Upsert to FileOutbox (so if we update a document multiple times before sync, it just stays PENDING)
        const fileOutboxData = { filePath, status: 'PENDING', attempts: 0, error: null };
        if (this.options.session) {
          await FileOutbox.findOneAndUpdate({ filePath }, { $set: fileOutboxData }, { upsert: true, session: this.options.session });
        } else {
          await FileOutbox.findOneAndUpdate({ filePath }, { $set: fileOutboxData }, { upsert: true });
        }
      }

      next();
    } catch (err) {
      console.error('Failed to auto-generate Outbox event from findOneAndUpdate:', err);
      next(err);
    }
  });
}

const { extractFilePaths } = require('../utils/fileScanner');

module.exports = offlineSyncPlugin;
