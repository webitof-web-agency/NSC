// local-backend/routes/localSyncRoutes.js
// Routes used by the Electron SyncManager to:
//   1. Fetch unsynced documents from each collection
//   2. Mark documents as synced after successful Atlas upload
//   3. Provide a sync auth token

'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { applyEvent } = require('../controllers/localSyncApplyController');
const { applyBootstrap } = require('../controllers/localSyncBootstrapController');
const { getReservationStatus, addBlock } = require('../controllers/reservationController');

router.post('/sync-apply', applyEvent);
router.post('/sync-bootstrap', applyBootstrap);

router.get('/number-reservations/status', getReservationStatus);
router.post('/number-reservations/add-block', addBlock);

// ─────────────────────────────────────────────
// Helper: get the model for a collection name
// ─────────────────────────────────────────────
function getModel(name) {
  const modelMap = {
    'users':            'User',
    'customers':        'Customer',
    'suppliers':        'Supplier',
    'invoices':         'Invoice',
    'quotations':       'Quotation',
    'credit-notes':     'CreditNote',
    'purchases':        'Purchase',
    'supplier-payments':'SupplierPayment',
    'attendance':       'Attendance',
    'staff-salary':     'StaffSalary',
  };
  const modelName = modelMap[name];
  if (!modelName) return null;
  try {
    return mongoose.model(modelName);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// GET /api/local/unsynced/:collection
// Returns all unsynced documents for a collection
// ─────────────────────────────────────────────
router.get('/unsynced/:collection', async (req, res) => {
  try {
    const Model = getModel(req.params.collection);
    if (!Model) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    const docs = await Model.find({
      '_syncStatus.synced': false,
      isDeleted: { $ne: true },
    })
    .limit(500) // Max 500 per sync cycle
    .lean();

    res.json({ success: true, data: docs, count: docs.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/local/mark-synced
// Mark documents as synced after successful Atlas upload
// Body: { collection: string, localIds: string[] }
// ─────────────────────────────────────────────
router.post('/mark-synced', async (req, res) => {
  try {
    const { collection, localIds } = req.body;

    if (!collection || !Array.isArray(localIds) || localIds.length === 0) {
      return res.status(400).json({ success: false, message: 'collection and localIds required' });
    }

    const Model = getModel(collection);
    if (!Model) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    const result = await Model.updateMany(
      { _localId: { $in: localIds } },
      {
        $set: {
          '_syncStatus.synced': true,
          '_syncStatus.syncedAt': new Date(),
          '_syncStatus.syncError': null,
        },
        $inc: { '_syncStatus.attemptCount': 1 },
      }
    );

    res.json({
      success: true,
      updated: result.modifiedCount,
      message: `Marked ${result.modifiedCount} records as synced`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/local/mark-sync-error
// Mark failed sync attempts with error info
// Body: { collection: string, localIds: string[], error: string }
// ─────────────────────────────────────────────
router.post('/mark-sync-error', async (req, res) => {
  try {
    const { collection, localIds, error } = req.body;

    const Model = getModel(collection);
    if (!Model) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    await Model.updateMany(
      { _localId: { $in: localIds } },
      {
        $set: { '_syncStatus.syncError': error },
        $inc: { '_syncStatus.attemptCount': 1 },
      }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/local/sync-stats
// Returns count of unsynced records per collection
// ─────────────────────────────────────────────
router.get('/sync-stats', async (req, res) => {
  try {
    const collections = [
      'users', 'customers', 'suppliers', 'invoices',
      'quotations', 'credit-notes', 'purchases',
      'supplier-payments', 'attendance', 'staff-salary'
    ];

    const stats = {};
    for (const col of collections) {
      const Model = getModel(col);
      if (Model) {
        stats[col] = await Model.countDocuments({ '_syncStatus.synced': false, isDeleted: { $ne: true } });
      }
    }

    const totalPending = Object.values(stats).reduce((sum, n) => sum + n, 0);
    res.json({ success: true, stats, totalPending });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/local/sync-token
// Returns the currently cached auth token for use in remote sync calls
// ─────────────────────────────────────────────
const LocalConfig = require('../models/LocalConfig');

router.get('/sync-token', async (req, res) => {
  try {
    const config = await LocalConfig.findOne({ key: 'syncToken' });
    res.json({ success: true, token: config ? config.value : null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sync-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (token) {
      await LocalConfig.findOneAndUpdate(
        { key: 'syncToken' },
        { value: token },
        { upsert: true }
      );
      res.json({ success: true, message: 'Token securely cached for offline sync' });
    } else {
      res.status(400).json({ success: false, message: 'Token required' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
// File Sync Internal Queues
// ─────────────────────────────────────────────
const FileOutbox = require('../models/FileOutbox');
const FilePullRequest = require('../models/FilePullRequest');

router.get('/file-outbox/pending', async (req, res) => {
  try {
    const files = await FileOutbox.find({ status: 'PENDING' }).limit(50);
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/file-outbox/status', async (req, res) => {
  try {
    const { id, status, error } = req.body;
    await FileOutbox.findByIdAndUpdate(id, { status, error, $inc: { attempts: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/file-pull/pending', async (req, res) => {
  try {
    const files = await FilePullRequest.find({ status: 'PENDING' }).limit(50);
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/file-pull/status', async (req, res) => {
  try {
    const { id, status, error } = req.body;
    await FilePullRequest.findByIdAndUpdate(id, { status, error, $inc: { attempts: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
