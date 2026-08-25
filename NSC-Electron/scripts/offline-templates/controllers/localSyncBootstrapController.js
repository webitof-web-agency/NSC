// local-backend/controllers/localSyncBootstrapController.js
'use strict';

const mongoose = require('mongoose');
const LocalConfig = require('../models/LocalConfig');

// Complete mapping of all collection keys to Mongoose Models
const COLLECTION_MAP = {
  'users': 'User',
  'customers': 'Customer',
  'suppliers': 'Supplier',
  'products': 'Product',
  'product-variants': 'ProductVariant',
  'categories': 'Category',
  'brands': 'Brand',
  'units': 'Unit',
  'tax-rates': 'TaxRate',
  'tax-groups': 'TaxGroup',
  'company-details': 'CompanySettings',
  'bank-details': 'BankDetail',
  'bank-transactions': 'BankTransaction',
  'signatures': 'Signature',
  'payment-modes': 'PaymentMode',
  'invoices': 'Invoice',
  'invoice-payments': 'InvoicePayment',
  'invoice-templates': 'InvoiceTemplate',
  'delivery-challans': 'DeliveryChallan',
  'quotations': 'Quotation',
  'purchases': 'Purchase',
  'credit-notes': 'CreditNote',
  'debit-notes': 'DebitNote',
  'supplier-payments': 'SupplierPayment',
  'expenses': 'Expense',
  'expense-categories': 'ExpenseCategory',
  'expense-change-logs': 'ExpenseChangeLog',
  'monthly-expenses': 'MonthlyExpense',
  'petty-cashes': 'PettyCash',
  'petty-cash-transactions': 'PettyCashTransaction',
  'inventories': 'Inventory',
  'attendance': 'Attendance',
  'staff-salary': 'StaffSalary',
  'customer-portal-branding': 'CustomerPortalBranding',
  'customer-portal-brandings': 'CustomerPortalBranding',
  'legal-settings': 'LegalSettings',
  'qr-settings': 'QrSettings',
  'general-settings': 'GeneralSetting',
  'localizations': 'Localization',
  'barcode-settings': 'BarcodeSettings',
  'mrp-settings': 'MrpSettings',
  'number-sequences': 'NumberSequence',
  'brokers': 'Broker',
  'broker-details': 'BrokerDetail',
  'commissions': 'Commission',
  'commission-system-settings': 'CommissionSystemSetting',
  'colors': 'Color',
  'sizes': 'Size',
  'cities': 'City',
  'states': 'State',
  'countries': 'Country',
  'currencies': 'Currency',
  'date-formats': 'DateFormat',
  'time-formats': 'TimeFormat',
  'timezones': 'Timezone',
  'custom-fields': 'CustomField',
  'custom-field-data-types': 'CustomFieldDataType',
  'roles': 'Role',
  'permissions': 'Permission',
  'modules': 'Module',
  'email-settings': 'EmailSettings',
  'email-templates': 'EmailTemplate',
  'eway-bills': 'EWayBill',
  'reminders': 'Reminder',
  'notifications': 'Notification',
  'todo-tasks': 'TodoTask'
};

exports.COLLECTION_MAP = COLLECTION_MAP;

function normalizeDoc(record) {
  if (!record || typeof record !== 'object') return null;
  const doc = { ...record };

  let docId = doc._id;
  if (typeof docId === 'string' && /^[0-9a-fA-F]{24}$/.test(docId)) {
    docId = new mongoose.Types.ObjectId(docId);
  } else if (!docId) {
    docId = new mongoose.Types.ObjectId();
  }

  if (!doc.syncId) {
    doc.syncId = String(record._id || docId);
  }

  if (doc.email === '' || doc.email === null) {
    delete doc.email;
  }

  delete doc._id;
  delete doc.__v;

  return { docId, updateData: doc };
}

exports.applyBootstrap = async (req, res) => {
  const { snapshot } = req.body;
  if (!snapshot || typeof snapshot !== 'object') {
    return res.status(400).json({ success: false, message: 'Snapshot payload required' });
  }

  const results = {};
  const errors = [];
  let anyDataSaved = false;

  try {
    for (const [collectionName, records] of Object.entries(snapshot)) {
      if (!Array.isArray(records) || records.length === 0) {
        results[collectionName] = 0;
        continue;
      }

      const modelName = COLLECTION_MAP[collectionName];
      if (!modelName) {
        console.warn(`[Sync Bootstrap] Skipping unmapped collection: ${collectionName}`);
        continue;
      }

      let Model;
      try {
        Model = mongoose.models[modelName] || require(`../models/${modelName}`);
      } catch (e) {
        console.warn(`[Sync Bootstrap] Could not load model ${modelName}:`, e.message);
        errors.push({ collection: collectionName, error: `Could not load model: ${e.message}` });
        continue;
      }

      try {
        // Drop obsolete duplicate index on suppliers if present
        if (collectionName === 'suppliers') {
          try {
            await Model.collection.dropIndex('email_1');
          } catch {}
        }

        const bulkOps = [];
        for (const record of records) {
          const normalized = normalizeDoc(record);
          if (!normalized) continue;

          bulkOps.push({
            updateOne: {
              filter: { _id: normalized.docId },
              update: {
                $set: normalized.updateData,
                $setOnInsert: { _id: normalized.docId }
              },
              upsert: true
            }
          });
        }

        if (bulkOps.length > 0) {
          const writeRes = await Model.bulkWrite(bulkOps, { ordered: false });
          const count = (writeRes.upsertedCount || 0) + (writeRes.modifiedCount || 0) + (writeRes.matchedCount || 0);
          results[collectionName] = count;
          if (count > 0) anyDataSaved = true;
          console.log(`[Sync Bootstrap] ${collectionName}: ${records.length} records processed (upserted: ${writeRes.upsertedCount}, modified: ${writeRes.modifiedCount})`);
        }

        // File scanning (non-blocking)
        try {
          const { extractFilePaths } = require('../utils/fileScanner');
          const FilePullRequest = mongoose.models.FilePullRequest || require('../models/FilePullRequest');
          const filePaths = new Set();
          for (const record of records) {
            extractFilePaths(record, filePaths);
          }
          if (filePaths.size > 0) {
            const fileOps = Array.from(filePaths).map(filePath => ({
              updateOne: {
                filter: { filePath },
                update: { $set: { filePath, status: 'PENDING', attempts: 0, error: null } },
                upsert: true
              }
            }));
            await FilePullRequest.bulkWrite(fileOps, { ordered: false });
          }
        } catch (fileErr) {
          console.warn(`[Sync Bootstrap FileScanner] ${collectionName} warning:`, fileErr.message);
        }

      } catch (colErr) {
        console.error(`⚠️ [Sync Bootstrap] Error processing collection ${collectionName}:`, colErr.message);
        errors.push({ collection: collectionName, error: colErr.message });
      }
    }

    // Set bootstrapCompleted flag in LocalConfig if records were saved
    if (anyDataSaved) {
      await LocalConfig.findOneAndUpdate(
        { key: 'bootstrapCompleted' },
        { value: true },
        { upsert: true }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Bootstrap snapshot applied successfully',
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('[Sync Bootstrap Error]:', error);
    res.status(500).json({ success: false, message: 'Failed to apply bootstrap snapshot', error: error.message });
  }
};
