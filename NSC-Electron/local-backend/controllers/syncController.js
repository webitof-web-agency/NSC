'use strict';

const mongoose = require('mongoose');
const SyncJournal = require('../models/SyncJournal');
const ZERO_SYNC_CURSOR = '000000000000000000000000';

const missingSyncIdQuery = {
  $or: [
    { syncId: { $exists: false } },
    { syncId: null },
    { syncId: '' },
  ],
};

/**
 * Existing cloud rows predate desktop synchronization. Give them a stable,
 * deterministic identity before returning a bootstrap snapshot so every PC
 * upserts the same local record instead of creating duplicates.
 */
async function backfillMissingSyncIds(models) {
  await Promise.all(models.map((Model) => Model.collection.updateMany(
    missingSyncIdQuery,
    [{
      $set: {
        syncId: { $concat: ['mongo:', { $toString: '$_id' }] },
        version: { $ifNull: ['$version', 1] },
      },
    }],
  )));
}

// GET /api/sync/pull?cursor=XYZ
exports.pullSyncEvents = async (req, res) => {
  try {
    const { cursor, limit = 500 } = req.query;
    
    // Build query: if cursor provided, fetch events after cursor
    const query = {};
    if (cursor) {
      query._id = { $gt: cursor }; // Since cursor is the MongoDB ObjectId
    }

    const events = await SyncJournal.find(query)
      .sort({ _id: 1 }) // Chronological order
      .limit(parseInt(limit, 10))
      .lean();

    // Determine new cursor (the _id of the last event in this batch)
    let nextCursor = cursor;
    if (events.length > 0) {
      nextCursor = events[events.length - 1]._id.toString();
    }

    res.status(200).json({
      success: true,
      data: {
        events,
        nextCursor,
        hasMore: events.length === parseInt(limit, 10)
      }
    });

  } catch (err) {
    console.error('Error pulling sync events:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to pull sync events',
      error: err.message
    });
  }
};

// GET /api/sync/bootstrap
exports.getBootstrapSnapshot = async (req, res) => {
  try {
    const userId = req.user; // from protect middleware
    
    // 1. Capture the latest cursor from SyncJournal
    const latestEvent = await SyncJournal.findOne().sort({ _id: -1 }).select('_id').lean();
    const cursor = latestEvent ? latestEvent._id.toString() : ZERO_SYNC_CURSOR;

    // 2. Fetch active records for all syncable collections for this user
    // (Importing models inline to avoid cyclic dependencies if any)
    const Customer = require('@models/Customer');
    const Invoice = require('@models/Invoice');
    const Quotation = require('@models/Quotation');
    const Supplier = require('@models/Supplier');
    const Purchase = require('@models/Purchase');
    const CreditNote = require('@models/CreditNote');
    const SupplierPayment = require('@models/SupplierPayment');
    const User = require('@models/User');
    const Attendance = require('@models/Attendance');
    const StaffSalary = require('@models/StaffSalary');
    const Product = require('@models/Product');
    const ProductVariant = require('@models/ProductVariant');
    const Category = require('@models/Category');
    const Brand = require('@models/Brand');
    const Unit = require('@models/Unit');
    const TaxGroup = require('@models/TaxGroup');
    const TaxRate = require('@models/TaxRate');
    const CompanySettings = require('@models/CompanySettings');
    const BankDetail = require('@models/BankDetail');
    const Signature = require('@models/Signature');
    const PaymentMode = require('@models/PaymentMode');
    const CustomerPortalBranding = require('@models/CustomerPortalBranding');
    const LegalSettings = require('@models/LegalSettings');
    const QrSettings = require('@models/QrSettings');
    const Notification = require('@models/Notification');
    const TodoTask = require('@models/TodoTask');
    
    await backfillMissingSyncIds([
      User,
      Customer,
      Supplier,
      Product,
      ProductVariant,
      Category,
      Brand,
      Unit,
      TaxGroup,
      TaxRate,
      CompanySettings,
      BankDetail,
      Signature,
      PaymentMode,
      Invoice,
      Quotation,
      CreditNote,
      Purchase,
      SupplierPayment,
      Attendance,
      StaffSalary,
      CustomerPortalBranding,
      LegalSettings,
      QrSettings,
      Notification,
      TodoTask,
    ]);

    // Include legacy rows where isDeleted did not exist yet.
    const baseQuery = { isDeleted: { $ne: true } };
    
    // Using Promise.all to fetch in parallel
    const [
      users,
      categories,
      brands,
      units,
      taxRates,
      taxGroups,
      products,
      productVariants,
      customers,
      suppliers,
      companySettings,
      bankDetails,
      signatures,
      paymentModes,
      invoices,
      quotations,
      purchases,
      creditNotes,
      supplierPayments,
      attendance,
      staffSalary,
      customerPortalBranding,
      legalSettings,
      qrSettings,
      notifications,
      todoTasks,
    ] = await Promise.all([
      User.find(baseQuery).lean().catch(() => []),
      Category.find(baseQuery).lean().catch(() => []),
      Brand.find(baseQuery).lean().catch(() => []),
      Unit.find(baseQuery).lean().catch(() => []),
      TaxRate.find(baseQuery).lean().catch(() => []),
      TaxGroup.find(baseQuery).lean().catch(() => []),
      Product.find(baseQuery).lean().catch(() => []),
      ProductVariant.find(baseQuery).lean().catch(() => []),
      Customer.find(baseQuery).lean().catch(() => []),
      Supplier.find(baseQuery).lean().catch(() => []),
      CompanySettings.find(baseQuery).lean().catch(() => []),
      BankDetail.find(baseQuery).lean().catch(() => []),
      Signature.find(baseQuery).lean().catch(() => []),
      PaymentMode.find(baseQuery).lean().catch(() => []),
      Invoice.find(baseQuery).lean().catch(() => []),
      Quotation.find(baseQuery).lean().catch(() => []),
      Purchase.find(baseQuery).lean().catch(() => []),
      CreditNote.find(baseQuery).lean().catch(() => []),
      SupplierPayment.find(baseQuery).lean().catch(() => []),
      Attendance.find(baseQuery).lean().catch(() => []),
      StaffSalary.find(baseQuery).lean().catch(() => []),
      CustomerPortalBranding.find(baseQuery).lean().catch(() => []),
      LegalSettings.find(baseQuery).lean().catch(() => []),
      QrSettings.find(baseQuery).lean().catch(() => []),
      Notification.find(baseQuery).lean().catch(() => []),
      TodoTask.find(baseQuery).lean().catch(() => []),
    ]);

    const snapshot = {
      users,
      categories,
      brands,
      units,
      'tax-rates': taxRates,
      'tax-groups': taxGroups,
      products,
      'product-variants': productVariants,
      customers,
      suppliers,
      'company-details': companySettings,
      'bank-details': bankDetails,
      signatures,
      'payment-modes': paymentModes,
      invoices,
      quotations,
      purchases,
      'credit-notes': creditNotes,
      'supplier-payments': supplierPayments,
      attendance,
      'staff-salary': staffSalary,
      'customer-portal-branding': customerPortalBranding,
      'legal-settings': legalSettings,
      'qr-settings': qrSettings,
      notifications,
      'todo-tasks': todoTasks,
    };

    res.status(200).json({
      success: true,
      data: {
        cursor,
        snapshot
      }
    });

  } catch (err) {
    console.error('Error fetching bootstrap snapshot:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bootstrap snapshot',
      error: err.message
    });
  }
};

// POST /api/sync/push
exports.pushSyncEvents = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Events array is required' });
    }

    const userId = req.user;
    
    // (Importing inline)
    const SyncConflict = require('@models/SyncConflict');
    const { resolveReferences } = require('../utils/referenceResolver');

    // Mapping of collection names to Cloud Models (all syncable collections)
    const COLLECTION_MAP = {
      'customers': require('@models/Customer'),
      'invoices': require('@models/Invoice'),
      'quotations': require('@models/Quotation'),
      'suppliers': require('@models/Supplier'),
      'purchases': require('@models/Purchase'),
      'credit-notes': require('@models/CreditNote'),
      'supplier-payments': require('@models/SupplierPayment'),
      'users': require('@models/User'),
      'attendance': require('@models/Attendance'),
      'staff-salary': require('@models/StaffSalary'),
      'products': require('@models/Product'),
      'product-variants': require('@models/ProductVariant'),
      'categories': require('@models/Category'),
      'brands': require('@models/Brand'),
      'units': require('@models/Unit'),
      'tax-groups': require('@models/TaxGroup'),
      'tax-rates': require('@models/TaxRate'),
      'company-details': require('@models/CompanySettings'),
      'bank-details': require('@models/BankDetail'),
      'signatures': require('@models/Signature'),
      'payment-modes': require('@models/PaymentMode'),
      'customer-portal-branding': require('@models/CustomerPortalBranding'),
      'legal-settings': require('@models/LegalSettings'),
      'qr-settings': require('@models/QrSettings'),
      'notifications': require('@models/Notification'),
      'todo-tasks': require('@models/TodoTask')
    };

    const processedEvents = [];
    const conflicts = [];

    for (const event of events) {
      const { eventId, syncId, operation, collectionName, payload, version, deviceId } = event;
      
      const Model = COLLECTION_MAP[collectionName];
      if (!Model) {
        console.warn(`[Sync Push] Unknown collection: ${collectionName}`);
        continue;
      }

      // Check if event was already processed (Idempotency check via SyncJournal)
      const existingJournal = await SyncJournal.findOne({ 'payload.eventId': eventId }).session(session);
      if (existingJournal) {
        processedEvents.push(eventId);
        continue;
      }

      const currentDoc = await Model.findOne({ syncId }).session(session).lean();

      // CONFLICT DETECTION
      // If the cloud already has a document, and its version is strictly greater than
      // the version the local device based its edit on, we have a conflict.
      if (currentDoc && currentDoc.version > version) {
        console.log(`[Sync Push] CONFLICT DETECTED on ${collectionName}/${syncId}. Local version ${version}, Cloud version ${currentDoc.version}`);
        
        await SyncConflict.create([{
          syncId,
          collectionName,
          deviceId,
          operation,
          localVersion: version,
          cloudVersion: currentDoc.version,
          localPayload: payload,
          cloudPayload: currentDoc
        }], { session });

        conflicts.push({ eventId, syncId, reason: 'version_conflict' });
        processedEvents.push(eventId); // Mark processed so client doesn't retry
        continue; // Skip applying this event
      }

      // NO CONFLICT - APPLY THE EVENT
      let resolvedPayload = { ...payload };
      
      // Resolve syncIds to cloud ObjectIds
      if (operation === 'CREATE' || operation === 'UPDATE') {
         resolvedPayload = await resolveReferences(collectionName, resolvedPayload, false);
      }

      delete resolvedPayload._id; // Ensure we don't overwrite _id

      // For safety, force the new version to be the cloud's current version + 1
      // (If it's a create, currentDoc is null, so it becomes 1)
      const newVersion = currentDoc ? currentDoc.version + 1 : 1;
      resolvedPayload.version = newVersion;

      if (operation === 'CREATE' || operation === 'UPDATE') {
        await Model.findOneAndUpdate(
          { syncId },
          { $set: resolvedPayload },
          { upsert: true, new: true, session, runValidators: false }
        );
      } else if (operation === 'DELETE') {
        await Model.findOneAndUpdate(
          { syncId },
          { $set: { isDeleted: true, deletedAt: payload.deletedAt || new Date(), version: newVersion } },
          { new: true, session, runValidators: false }
        );
      }

      // INSERT INTO SYNC JOURNAL (so other devices can pull it)
      // We attach the original eventId into the payload so we can check idempotency
      await SyncJournal.create([{
        syncId,
        operation,
        collectionName,
        payload: { ...resolvedPayload, eventId }, 
        deviceId, // The device that originated the change
        timestamp: new Date()
      }], { session });

      processedEvents.push(eventId);
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      processedEvents,
      conflicts
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error pushing sync events:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to push sync events',
      error: err.message
    });
  }
};

// POST /api/sync/allocate-numbers
exports.allocateNumbers = async (req, res) => {
  try {
    const { type, count } = req.body;
    
    if (!type || !count || count < 1) {
      return res.status(400).json({ success: false, message: 'Invalid allocation request' });
    }

    const NumberSequence = require('@models/NumberSequence');

    // Atomically find and increment the sequence
    const sequence = await NumberSequence.findOneAndUpdate(
      { type },
      { $inc: { currentValue: count } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // If it was just created by upsert, sequence.currentValue will be 'count'.
    // The reserved block is from (sequence.currentValue - count + 1) to (sequence.currentValue)
    const startValue = sequence.currentValue - count + 1;
    const endValue = sequence.currentValue;

    // We also need to set default prefixes if it was newly inserted, though
    // setDefaultsOnInsert will apply schema defaults. But our prefix doesn't have a default.
    // So we should initialize it if missing.
    if (!sequence.prefix) {
      sequence.prefix = type === 'INVOICE' ? 'INV-' : (type === 'QUOTATION' ? 'QTN-' : `${type}-`);
      await sequence.save();
    }

    res.status(200).json({
      success: true,
      data: {
        type: sequence.type,
        prefix: sequence.prefix,
        padding: sequence.padding,
        startValue,
        endValue,
        count
      }
    });

  } catch (err) {
    console.error('Error allocating numbers:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to allocate numbers',
      error: err.message
    });
  }
};

// ─────────────────────────────────────────────
// CONFLICT RESOLUTION (Phase 19)
// ─────────────────────────────────────────────

exports.getConflicts = async (req, res) => {
  try {
    const SyncConflict = require('@models/SyncConflict');
    const conflicts = await SyncConflict.find({ status: 'UNRESOLVED' }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, conflicts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resolveConflict = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { conflictId, resolution } = req.body;
    if (!conflictId || !resolution || !['USE_LOCAL', 'USE_CLOUD'].includes(resolution)) {
      return res.status(400).json({ success: false, message: 'Invalid resolution parameters' });
    }

    const SyncConflict = require('@models/SyncConflict');
    const conflict = await SyncConflict.findById(conflictId).session(session);
    
    if (!conflict) return res.status(404).json({ success: false, message: 'Conflict not found' });
    if (conflict.status === 'RESOLVED') return res.status(400).json({ success: false, message: 'Already resolved' });

    if (resolution === 'USE_LOCAL') {
      // Forcefully apply local payload over cloud payload
      const COLLECTION_MAP = {
        'customers': require('@models/Customer'),
        'invoices': require('@models/Invoice'),
        'quotations': require('@models/Quotation'),
        'suppliers': require('@models/Supplier'),
        'purchases': require('@models/Purchase'),
        'credit-notes': require('@models/CreditNote'),
        'supplier-payments': require('@models/SupplierPayment'),
        'users': require('@models/User'),
        'attendance': require('@models/Attendance'),
        'staff-salary': require('@models/StaffSalary')
      };
      
      const Model = COLLECTION_MAP[conflict.collectionName];
      const { resolveReferences } = require('../utils/referenceResolver');
      let resolvedPayload = await resolveReferences(conflict.collectionName, conflict.localPayload, false);
      delete resolvedPayload._id;

      // Force increment version
      resolvedPayload.version = conflict.cloudVersion + 1;

      if (conflict.operation === 'CREATE' || conflict.operation === 'UPDATE') {
        await Model.findOneAndUpdate(
          { syncId: conflict.syncId },
          { $set: resolvedPayload },
          { upsert: true, session, runValidators: false }
        );
      } else if (conflict.operation === 'DELETE') {
        await Model.findOneAndUpdate(
          { syncId: conflict.syncId },
          { $set: { isDeleted: true, deletedAt: new Date(), version: resolvedPayload.version } },
          { session, runValidators: false }
        );
      }

      // Add to SyncJournal so the fix propagates back down to clients
      await SyncJournal.create([{
        syncId: conflict.syncId,
        operation: conflict.operation,
        collectionName: conflict.collectionName,
        payload: resolvedPayload,
        deviceId: 'CLOUD_ADMIN_OVERRIDE',
        timestamp: new Date()
      }], { session });
    }

    // Mark as resolved
    conflict.status = 'RESOLVED';
    conflict.resolution = resolution;
    conflict.resolvedAt = new Date();
    await conflict.save({ session });

    await session.commitTransaction();
    session.endSession();
    res.status(200).json({ success: true, message: `Conflict resolved using ${resolution}` });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// FILE SYNC ENDPOINTS (Phase 17)
// ─────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

// POST /api/sync/file-push
exports.filePush = async (req, res) => {
  try {
    const file = req.file;
    const { filePath } = req.body;

    if (!file || !filePath) {
      return res.status(400).json({ success: false, message: 'Missing file or filePath' });
    }

    // Security check: ensure filePath is within public/uploads/
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith('uploads/') && !normalizedPath.startsWith('public/uploads/')) {
      return res.status(403).json({ success: false, message: 'Invalid target directory' });
    }

    // Determine absolute destination path
    const destPath = path.join(__dirname, '../public', normalizedPath);
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    // Move from multer temp dir to destination
    fs.renameSync(file.path, destPath);

    console.log(`[File Sync Push] Received and saved ${normalizedPath}`);
    res.status(200).json({ success: true, message: 'File synced to cloud' });

  } catch (err) {
    console.error('[File Sync Push Error]:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: 'Failed to process file' });
  }
};

// GET /api/sync/file-pull?path=...
exports.filePull = async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath) {
      return res.status(400).json({ success: false, message: 'Missing filePath query param' });
    }

    // Security check
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith('uploads/') && !normalizedPath.startsWith('public/uploads/')) {
      return res.status(403).json({ success: false, message: 'Invalid directory' });
    }

    const absPath = path.join(__dirname, '../public', normalizedPath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    console.log(`[File Sync Pull] Streaming ${normalizedPath} to client...`);
    res.sendFile(absPath);

  } catch (err) {
    console.error('[File Sync Pull Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to stream file' });
  }
};
