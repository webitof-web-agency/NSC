'use strict';

const mongoose = require('mongoose');

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

exports.applyBootstrap = async (req, res) => {
  const { snapshot } = req.body;
  if (!snapshot || typeof snapshot !== 'object') {
    return res.status(400).json({ success: false, message: 'Snapshot payload required' });
  }

  try {
    for (const [collectionName, records] of Object.entries(snapshot)) {
      if (!Array.isArray(records) || records.length === 0) continue;

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
        continue;
      }

      try {
        // Drop obsolete email index on suppliers if present
        if (collectionName === 'suppliers') {
          try {
            await Model.collection.dropIndex('email_1');
          } catch {}
        }

        // Prepare bulk upserts preserving _id and syncId
        const bulkOps = [];
        for (const record of records) {
          if (!record || typeof record !== 'object') continue;
          
          const updateData = { ...record };
          let docId;
          if (updateData._id && mongoose.Types.ObjectId.isValid(updateData._id)) {
            docId = new mongoose.Types.ObjectId(String(updateData._id));
          } else {
            docId = new mongoose.Types.ObjectId();
          }

          if (!updateData.syncId) {
            updateData.syncId = String(record._id || docId);
          }

          if (updateData.email === '') {
            delete updateData.email;
          }

          // In MongoDB, _id is immutable and must NOT be in $set during upsert!
          delete updateData._id;
          delete updateData.__v;

          bulkOps.push({
            updateOne: {
              filter: { _id: docId },
              update: {
                $set: updateData,
                $setOnInsert: { _id: docId }
              },
              upsert: true
            }
          });
        }

        if (bulkOps.length > 0) {
          const result = await Model.bulkWrite(bulkOps, { ordered: false });
          console.log(`[Sync Bootstrap] ${collectionName}: ${records.length} records processed (upserted: ${result.upsertedCount}, modified: ${result.modifiedCount})`);
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
      }
    }

    res.status(200).json({ success: true, message: 'Bootstrap snapshot applied successfully' });

  } catch (error) {
    console.error('[Sync Bootstrap Error]:', error);
    res.status(500).json({ success: false, message: 'Failed to apply bootstrap snapshot', error: error.message });
  }
};
