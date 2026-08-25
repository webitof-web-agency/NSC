// local-backend/controllers/localSyncApplyController.js
'use strict';

const mongoose = require('mongoose');

const COLLECTION_MODEL_MAP = {
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
  'invoice-payments': 'InvoicePayment',
  'attendance': 'Attendance',
  'staff-salary': 'StaffSalary',
  'products': 'Product',
  'product-variants': 'ProductVariant',
  'categories': 'Category',
  'brands': 'Brand',
  'units': 'Unit',
  'tax-groups': 'TaxGroup',
  'tax-rates': 'TaxRate',
  'company-details': 'CompanySettings',
  'bank-details': 'BankDetail',
  'signatures': 'Signature',
  'payment-modes': 'PaymentMode',
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
  'customer-portal-branding': 'CustomerPortalBranding',
  'legal-settings': 'LegalSettings',
  'qr-settings': 'QrSettings',
  'roles': 'Role',
  'permissions': 'Permission',
  'bank-transactions': 'BankTransaction',
};

const DATE_FIELD_NAMES = new Set([
  'createdAt', 'updatedAt', 'invoiceDate', 'dueDate', 'date',
  'paymentDate', 'payment_date', 'transactionDate', 'received_on',
  'chequeDate', 'dob', 'joiningDate', 'deletedAt', 'lastLogin',
  'checkInTime', 'checkOutTime', 'expiryDate', 'birthDate', 'anniversaryDate'
]);

function deepNormalize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepNormalize);
  if (obj instanceof Date || obj instanceof mongoose.Types.ObjectId) return obj;

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }

    if (DATE_FIELD_NAMES.has(key) || key.endsWith('Date') || key.endsWith('At') || key.endsWith('Time')) {
      if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value);
        result[key] = !isNaN(d.getTime()) ? d : value;
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
      if (key === '_id' || key.endsWith('Id') || key.endsWith('_id') || key === 'user' || key === 'customer' || key === 'supplier' || key === 'product' || key === 'billTo' || key === 'billFrom' || key === 'bank') {
        result[key] = new mongoose.Types.ObjectId(value);
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'object') {
      result[key] = deepNormalize(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function normalizeDoc(record, Model) {
  if (!record || typeof record !== 'object') return null;

  let docObj;
  try {
    if (Model) {
      const instance = new Model(record);
      docObj = instance.toObject ? instance.toObject({ depopulate: true }) : { ...record };
    } else {
      docObj = { ...record };
    }
  } catch (e) {
    docObj = { ...record };
  }

  const normalized = deepNormalize(docObj);

  let docId = normalized._id;
  if (!docId && record._id) {
    if (typeof record._id === 'string' && /^[0-9a-fA-F]{24}$/.test(record._id)) {
      docId = new mongoose.Types.ObjectId(record._id);
    } else {
      docId = record._id;
    }
  } else if (!docId) {
    docId = new mongoose.Types.ObjectId();
  }

  if (!normalized.syncId) {
    normalized.syncId = String(record._id || docId);
  }

  if (record.createdAt) {
    normalized.createdAt = new Date(record.createdAt);
  } else if (!normalized.createdAt) {
    if (docId instanceof mongoose.Types.ObjectId) {
      normalized.createdAt = docId.getTimestamp();
    } else {
      normalized.createdAt = new Date();
    }
  }

  if (record.updatedAt) {
    normalized.updatedAt = new Date(record.updatedAt);
  } else if (!normalized.updatedAt) {
    normalized.updatedAt = normalized.createdAt;
  }

  if (normalized.email === '' || normalized.email === null) {
    delete normalized.email;
  }

  delete normalized._id;
  delete normalized.__v;

  return { docId, updateData: normalized };
}

function getModel(name) {
  const modelName = COLLECTION_MODEL_MAP[name];
  if (!modelName) return null;
  try {
    return mongoose.models[modelName] || require(`@models/${modelName}`);
  } catch (err) {
    console.warn(`[Sync Apply] Model for collection "${name}" not found:`, err.message);
    return null;
  }
}

exports.applyEvent = async (req, res) => {
  try {
    const rawEvents = req.body.events || (req.body.event ? [req.body.event] : null);
    if (!rawEvents || !Array.isArray(rawEvents) || rawEvents.length === 0) {
      return res.status(400).json({ success: false, message: 'Event or events array is required' });
    }

    let appliedCount = 0;
    for (const event of rawEvents) {
      const { collectionName, operation, syncId, version, payload } = event;
      if (!collectionName || !syncId) continue;

      const Model = getModel(collectionName);
      if (!Model) {
        console.warn(`[Sync Apply] Unknown collection name: ${collectionName}`);
        continue;
      }

      if (operation === 'DELETE') {
        await Model.findOneAndUpdate(
          { syncId },
          { $set: { isDeleted: true, deletedAt: new Date(), version } },
          { $ignoreOutbox: true }
        );
      } else {
        const normalized = normalizeDoc(payload || {}, Model);
        if (!normalized) continue;

        await Model.replaceOne(
          { 
            $or: [
              { syncId },
              { _id: normalized.docId }
            ]
          },
          {
            _id: normalized.docId,
            ...normalized.updateData,
            syncId,
            version
          },
          { upsert: true, $ignoreOutbox: true }
        );
      }
      appliedCount++;
    }

    res.status(200).json({ success: true, message: `Applied ${appliedCount} sync events successfully`, appliedCount });
  } catch (err) {
    console.error('Error applying sync events locally:', err);
    res.status(500).json({ success: false, message: 'Failed to apply sync events', error: err.message });
  }
};
