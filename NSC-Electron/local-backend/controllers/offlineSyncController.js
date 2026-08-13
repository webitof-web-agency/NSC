// controllers/offlineSyncController.js
// Handles sync-from-offline requests from the Electron desktop app
// Uses _localId for idempotent upserts — prevents duplicate records

'use strict';

const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Quotation = require('../models/Quotation');
const CreditNote = require('../models/CreditNote');
const Purchase = require('../models/Purchase');
const Supplier = require('../models/Supplier');
const SupplierPayment = require('../models/SupplierPayment');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const StaffSalary = require('../models/StaffSalary');

// ─────────────────────────────────────────────
// Map collection names → Model + ID field
// ─────────────────────────────────────────────
const COLLECTION_MAP = {
  invoices:          { Model: Invoice,         autoIdField: 'invoiceNumber' },
  quotations:        { Model: Quotation,        autoIdField: 'quotationId' },
  'credit-notes':    { Model: CreditNote,       autoIdField: 'creditNoteNumber' },
  purchases:         { Model: Purchase,         autoIdField: 'purchaseId' },
  suppliers:         { Model: Supplier,         autoIdField: null },
  'supplier-payments': { Model: SupplierPayment, autoIdField: null },
  customers:         { Model: Customer,         autoIdField: null },
  users:             { Model: User,             autoIdField: null },
  attendance:        { Model: Attendance,       autoIdField: 'attendanceId' },
  'staff-salary':    { Model: StaffSalary,      autoIdField: null },
};

// ─────────────────────────────────────────────
// POST /api/admin/:collection/sync-offline
// Body: { records: Array<document> }
// Performs idempotent upsert using _localId as the dedup key
// Returns: { synced: string[], failed: { localId, error }[] }
// ─────────────────────────────────────────────
async function syncFromOffline(req, res) {
  const { collection } = req.params;
  const { records } = req.body;

  if (!COLLECTION_MAP[collection]) {
    return res.status(404).json({
      success: false,
      message: `Collection '${collection}' not supported for offline sync`,
    });
  }

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, message: 'records array required' });
  }

  const { Model, autoIdField } = COLLECTION_MAP[collection];
  const synced = [];
  const failed = [];

  for (const record of records) {
    try {
      if (!record._localId) {
        failed.push({ error: 'Missing _localId', record: record._id });
        continue;
      }

      // Prepare document — strip local-only fields before upserting
      const {
        _id,          // Don't force local _id into Atlas
        _localId,
        _syncStatus,
        _createdOffline,
        __v,
        ...docData
      } = record;

      // Strip the auto-generated number field (server will regenerate)
      // This avoids unique key collisions on Atlas with locally-generated IDs
      if (autoIdField && docData[autoIdField]) {
        delete docData[autoIdField]; // Let server pre-save hook generate a new one
      }

      // Use findOneAndUpdate with upsert to prevent duplicates
      // If this _localId already exists in Atlas → update it (idempotent)
      // If not → create it (upsert)
      const result = await Model.findOneAndUpdate(
        { _localId: _localId },  // Match by offline ID
        {
          $set: {
            ...docData,
            _localId: _localId,
            _createdOffline: true,
            _syncedFromOfflineAt: new Date(),
          },
          $setOnInsert: {
            _localId: _localId,
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: false, // Skip validators — offline data may have partial refs
          lean: false,
        }
      );

      if (result) {
        synced.push(_localId);
      }

    } catch (err) {
      console.error(`❌ Failed to sync record ${record._localId}:`, err.message);
      failed.push({
        localId: record._localId,
        error: err.message,
      });
    }
  }

  res.json({
    success: true,
    collection,
    total: records.length,
    synced,
    failed,
    message: `Synced ${synced.length}/${records.length} records`,
  });
}

// ─────────────────────────────────────────────
// GET /api/admin/offline-sync/status
// Returns sync capability info
// ─────────────────────────────────────────────
async function getSyncStatus(req, res) {
  res.json({
    success: true,
    supportedCollections: Object.keys(COLLECTION_MAP),
    serverTime: new Date().toISOString(),
  });
}

module.exports = { syncFromOffline, getSyncStatus };
