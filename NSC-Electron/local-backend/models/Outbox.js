// local-backend/models/Outbox.js
'use strict';

const mongoose = require('mongoose');

const outboxSchema = new mongoose.Schema({
  // UUID identifying this specific sync event (idempotency key for cloud)
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  
  // The identity of the affected document
  syncId: {
    type: String,
    required: true,
    index: true,
  },

  // 'CREATE', 'UPDATE', 'DELETE'
  operation: {
    type: String,
    required: true,
    enum: ['CREATE', 'UPDATE', 'DELETE'],
  },

  // Which collection this applies to (e.g., 'customers', 'invoices')
  collectionName: {
    type: String,
    required: true,
    index: true,
  },

  // The actual document payload (diff or full document)
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },

  // Incremental logical version
  version: {
    type: Number,
    required: true,
  },

  // Has this event been successfully pushed to Atlas?
  processed: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  // When the event occurred locally
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // When it was successfully processed
  processedAt: {
    type: Date,
    default: null,
  }
});

module.exports = mongoose.model('Outbox', outboxSchema);
