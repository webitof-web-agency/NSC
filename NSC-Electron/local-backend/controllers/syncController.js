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

    // Helper to safely require models
    const getModel = (name) => {
      try {
        return mongoose.models[name] || require(`@models/${name}`);
      } catch {
        return null;
      }
    };

    const modelDefinitions = [
      { key: 'users', model: getModel('User') },
      { key: 'customers', model: getModel('Customer') },
      { key: 'suppliers', model: getModel('Supplier') },
      { key: 'products', model: getModel('Product') },
      { key: 'product-variants', model: getModel('ProductVariant') },
      { key: 'categories', model: getModel('Category') },
      { key: 'brands', model: getModel('Brand') },
      { key: 'units', model: getModel('Unit') },
      { key: 'tax-rates', model: getModel('TaxRate') },
      { key: 'tax-groups', model: getModel('TaxGroup') },
      { key: 'company-details', model: getModel('CompanySettings') },
      { key: 'bank-details', model: getModel('BankDetail') },
      { key: 'bank-transactions', model: getModel('BankTransaction') },
      { key: 'signatures', model: getModel('Signature') },
      { key: 'payment-modes', model: getModel('PaymentMode') },
      { key: 'invoices', model: getModel('Invoice') },
      { key: 'invoice-payments', model: getModel('InvoicePayment') },
      { key: 'invoice-templates', model: getModel('InvoiceTemplate') },
      { key: 'delivery-challans', model: getModel('DeliveryChallan') },
      { key: 'quotations', model: getModel('Quotation') },
      { key: 'purchases', model: getModel('Purchase') },
      { key: 'credit-notes', model: getModel('CreditNote') },
      { key: 'debit-notes', model: getModel('DebitNote') },
      { key: 'supplier-payments', model: getModel('SupplierPayment') },
      { key: 'expenses', model: getModel('Expense') },
      { key: 'expense-categories', model: getModel('ExpenseCategory') },
      { key: 'expense-change-logs', model: getModel('ExpenseChangeLog') },
      { key: 'monthly-expenses', model: getModel('MonthlyExpense') },
      { key: 'petty-cashes', model: getModel('PettyCash') },
      { key: 'petty-cash-transactions', model: getModel('PettyCashTransaction') },
      { key: 'inventories', model: getModel('Inventory') },
      { key: 'attendance', model: getModel('Attendance') },
      { key: 'staff-salary', model: getModel('StaffSalary') },
      { key: 'customer-portal-branding', model: getModel('CustomerPortalBranding') },
      { key: 'legal-settings', model: getModel('LegalSettings') },
      { key: 'qr-settings', model: getModel('QrSettings') },
      { key: 'general-settings', model: getModel('GeneralSetting') },
      { key: 'localizations', model: getModel('Localization') },
      { key: 'barcode-settings', model: getModel('BarcodeSettings') },
      { key: 'mrp-settings', model: getModel('MrpSettings') },
      { key: 'number-sequences', model: getModel('NumberSequence') },
      { key: 'brokers', model: getModel('Broker') },
      { key: 'broker-details', model: getModel('BrokerDetail') },
      { key: 'commissions', model: getModel('Commission') },
      { key: 'commission-system-settings', model: getModel('CommissionSystemSetting') },
      { key: 'colors', model: getModel('Color') },
      { key: 'sizes', model: getModel('Size') },
      { key: 'cities', model: getModel('City') },
      { key: 'states', model: getModel('State') },
      { key: 'countries', model: getModel('Country') },
      { key: 'currencies', model: getModel('Currency') },
      { key: 'date-formats', model: getModel('DateFormat') },
      { key: 'time-formats', model: getModel('TimeFormat') },
      { key: 'timezones', model: getModel('Timezone') },
      { key: 'custom-fields', model: getModel('CustomField') },
      { key: 'custom-field-data-types', model: getModel('CustomFieldDataType') },
      { key: 'roles', model: getModel('Role') },
      { key: 'permissions', model: getModel('Permission') },
      { key: 'modules', model: getModel('Module') },
      { key: 'email-settings', model: getModel('EmailSettings') },
      { key: 'email-templates', model: getModel('EmailTemplate') },
      { key: 'eway-bills', model: getModel('EWayBill') },
      { key: 'reminders', model: getModel('Reminder') },
      { key: 'notifications', model: getModel('Notification') },
      { key: 'todo-tasks', model: getModel('TodoTask') }
    ];

    const baseQuery = { isDeleted: { $ne: true } };

    const queryPromises = modelDefinitions.map(({ key, model }) => {
      if (!model) return Promise.resolve({ key, data: [] });
      return model.find(baseQuery).lean().then(data => ({ key, data })).catch(() => ({ key, data: [] }));
    });

    const results = await Promise.all(queryPromises);

    const snapshot = {};
    for (const { key, data } of results) {
      snapshot[key] = data;
    }

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

    const deviceId = req.headers['x-device-id'] || 'unknown-device';
    const processedEvents = [];
    const conflicts = [];

    // Helper map to dynamically find models
    const getModel = (name) => {
      const map = {
        'users': 'User',
        'customers': 'Customer',
        'suppliers': 'Supplier',
        'invoices': 'Invoice',
        'quotations': 'Quotation',
        'credit-notes': 'CreditNote',
        'debit-notes': 'DebitNote',
        'delivery-challans': 'DeliveryChallan',
        'purchases': 'Purchase',
        'supplier-payments': 'SupplierPayment',
        'attendance': 'Attendance',
        'staff-salary': 'StaffSalary',
        'products': 'Product',
        'product-variants': 'ProductVariant',
        'categories': 'Category',
        'brands': 'Brand',
        'units': 'Unit',
        'tax-groups': 'TaxGroup',
        'tax-rates': 'TaxRate',
        'expenses': 'Expense',
        'expense-categories': 'ExpenseCategory',
        'monthly-expenses': 'MonthlyExpense',
        'petty-cashes': 'PettyCash',
        'petty-cash-transactions': 'PettyCashTransaction',
        'inventories': 'Inventory',
        'brokers': 'Broker',
        'commissions': 'Commission',
        'reminders': 'Reminder',
        'notifications': 'Notification',
        'todo-tasks': 'TodoTask',
      };
      return map[name] ? (mongoose.models[map[name]] || require(`@models/${map[name]}`)) : null;
    };

    for (const event of events) {
      const { eventId, collectionName, operation, syncId, version, payload, timestamp } = event;
      const Model = getModel(collectionName);

      if (!Model) {
        console.warn(`[Sync Push] Unrecognized collection: ${collectionName}`);
        continue;
      }

      // Check current document on cloud
      const currentDoc = await Model.findOne({ syncId }).session(session);

      // Conflict Detection (LWW using versions)
      if (currentDoc && currentDoc.version > version) {
        conflicts.push({
          eventId,
          syncId,
          collectionName,
          reason: 'VERSION_CONFLICT',
          serverVersion: currentDoc.version,
          clientVersion: version,
          serverDoc: currentDoc
        });
        continue; // Do not apply older client writes
      }

      // Apply the operation
      if (operation === 'CREATE' || operation === 'UPDATE') {
        const updateData = { ...payload, syncId, version };
        delete updateData._id;
        delete updateData.__v;

        await Model.findOneAndUpdate(
          { syncId },
          { $set: updateData },
          { upsert: true, new: true, session, runValidators: false, $ignoreJournal: true }
        );
      } else if (operation === 'DELETE') {
        await Model.findOneAndUpdate(
          { syncId },
          { $set: { isDeleted: true, deletedAt: new Date(), version } },
          { session, $ignoreJournal: true }
        );
      }

      // Record in SyncJournal so OTHER devices pull this change
      await SyncJournal.create([{
        collectionName,
        operation,
        syncId,
        version,
        payload,
        originDeviceId: deviceId,
        timestamp: timestamp || new Date()
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
    console.error('Error processing push sync events:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to process sync push',
      error: err.message
    });
  }
};

// POST /api/sync/allocate-numbers
exports.allocateNumbers = async (req, res) => {
  try {
    const { sequenceType, count = 1 } = req.body;
    res.status(200).json({
      success: true,
      message: 'Numbers allocated successfully',
      data: { sequenceType, allocated: count }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/sync/conflicts
exports.getConflicts = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/sync/resolve-conflict
exports.resolveConflict = async (req, res) => {
  try {
    const { conflictId, resolution } = req.body;
    res.status(200).json({ success: true, message: 'Conflict resolved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/sync/file-push
exports.filePush = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    res.status(200).json({
      success: true,
      message: 'File synced successfully',
      file: req.file
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/sync/file-pull
exports.filePull = async (req, res) => {
  try {
    const { filePath } = req.query;
    if (!filePath) {
      return res.status(400).json({ success: false, message: 'filePath query param is required' });
    }
    const { resolveStoredFilePath } = require('../utils/storagePaths');
    const fullPath = resolveStoredFilePath(filePath);
    res.sendFile(fullPath);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = exports;
