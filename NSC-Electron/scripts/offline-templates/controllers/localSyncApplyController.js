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
    const { event } = req.body;
    if (!event) {
      return res.status(400).json({ success: false, message: 'Event is required' });
    }

    const { collectionName, operation, syncId, version, payload } = event;
    const Model = getModel(collectionName);

    if (!Model) {
      console.warn(`[Sync Apply] Unknown collection name: ${collectionName}`);
      return res.status(200).json({ success: true, skipped: true, reason: 'unknown_collection' });
    }

    if (operation === 'DELETE') {
      await Model.findOneAndUpdate(
        { syncId },
        { $set: { isDeleted: true, deletedAt: new Date(), version } },
        { $ignoreOutbox: true }
      );
    } else {
      const updateData = { ...(payload || {}), syncId, version };
      const docId = updateData._id ? new mongoose.Types.ObjectId(updateData._id) : undefined;
      delete updateData._id;
      delete updateData.__v;

      const updateOp = {
        $set: updateData
      };
      if (docId) {
        updateOp.$setOnInsert = { _id: docId };
      }

      await Model.findOneAndUpdate(
        { syncId },
        updateOp,
        { upsert: true, new: true, runValidators: false, $ignoreOutbox: true }
      );
    }

    res.status(200).json({ success: true, message: 'Event applied successfully' });
  } catch (err) {
    console.error('Error applying sync event locally:', err);
    res.status(500).json({ success: false, message: 'Failed to apply sync event', error: err.message });
  }
};
