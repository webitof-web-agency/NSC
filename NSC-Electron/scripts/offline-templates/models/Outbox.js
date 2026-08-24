// local-backend/models/Outbox.js
'use strict';

const mongoose = require('mongoose');

const outboxSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  syncId: { type: String, required: true, index: true },
  operation: { type: String, enum: ['CREATE', 'UPDATE', 'DELETE'], required: true },
  collectionName: { type: String, required: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed },
  version: { type: Number, default: 1 },
  status: { type: String, enum: ['PENDING', 'SYNCED', 'FAILED'], default: 'PENDING', index: true },
  processed: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  error: { type: String },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.models.Outbox || mongoose.model('Outbox', outboxSchema);
