// middleware/offlineSync.js
// Mongoose plugin that tracks sync identity and changes:
// - On Local Desktop: writes mutations to Outbox collection to push to Cloud
// - On Cloud Backend: writes mutations to SyncJournal collection for Desktop apps to pull

'use strict';

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const IGNORED_COLLECTIONS = new Set([
  'outbox', 'outboxes',
  'syncjournal', 'syncjournals',
  'fileoutbox', 'fileoutboxes',
  'filepullrequest', 'filepullrequests',
  'localconfig', 'localconfigs',
  'notification', 'notifications',
  'reminder', 'reminders',
  'session', 'sessions',
  'loginactivity', 'loginactivities'
]);

function toSyncCollectionName(mongooseName) {
  if (!mongooseName || typeof mongooseName !== 'string') return '';
  const lower = mongooseName.toLowerCase();
  if (IGNORED_COLLECTIONS.has(lower)) return '';

  const map = {
    productvariants: 'product-variants',
    taxgroups: 'tax-groups',
    taxrates: 'tax-rates',
    companysettings: 'company-details',
    bankdetails: 'bank-details',
    banktransactions: 'bank-transactions',
    paymentmodes: 'payment-modes',
    invoicetemplates: 'invoice-templates',
    invoicepayments: 'invoice-payments',
    deliverychallans: 'delivery-challans',
    creditnotes: 'credit-notes',
    debitnotes: 'debit-notes',
    supplierpayments: 'supplier-payments',
    staffsalaries: 'staff-salary',
    expensecategories: 'expense-categories',
    expensechangelogs: 'expense-change-logs',
    monthlyexpenses: 'monthly-expenses',
    pettycashes: 'petty-cashes',
    pettycashtransactions: 'petty-cash-transactions',
    customerportalbrandings: 'customer-portal-branding',
    legalsettings: 'legal-settings',
    qrsettings: 'qr-settings',
    generalsettings: 'general-settings',
    barcodesettings: 'barcode-settings',
    mrpsettings: 'mrp-settings',
    numbersequences: 'number-sequences',
    brokerdetails: 'broker-details',
    commissionsystemsettings: 'commission-system-settings',
    customfields: 'custom-fields',
    customfielddatatypes: 'custom-field-data-types',
    emailsettings: 'email-settings',
    emailtemplates: 'email-templates',
    ewaybills: 'eway-bills',
    todotasks: 'todo-tasks'
  };
  return map[lower] || lower;
}

/**
 * Add this plugin to any model that receives/generates synced records.
 * Usage: schema.plugin(offlineSyncPlugin)
 */
function offlineSyncPlugin(schema) {
  // Never attach plugin to internal sync/auth models
  const collectionName = schema.options?.collection || '';
  if (collectionName && IGNORED_COLLECTIONS.has(collectionName.toLowerCase())) {
    return;
  }

  schema.add({
    _localId: {
      type: String,
      default: () => uuidv4(),
      index: true,
      sparse: true,
    },
    syncId: {
      type: String,
      default: () => uuidv4(),
      index: true,
      unique: true,
      sparse: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    _syncStatus: {
      synced: {
        type: Boolean,
        default: false,
        index: true,
      },
      syncedAt: {
        type: Date,
        default: null,
      },
      syncError: {
        type: String,
        default: null,
      },
      attemptCount: {
        type: Number,
        default: 0,
      },
    },
    _createdOffline: {
      type: Boolean,
      default: false,
    },
    _syncedFromOfflineAt: {
      type: Date,
      default: null,
    },
  });

  // Auto-generate syncId and increment version before save
  schema.pre('save', function(next) {
    if (!this.syncId) {
      this.syncId = uuidv4();
    }
    if (!this.isNew && !this.$ignoreOutbox && !this.$ignoreJournal) {
      this.version = (this.version || 0) + 1;
    }
    next();
  });

  // Pre-update version bump
  schema.pre('findOneAndUpdate', function(next) {
    if (!this.getOptions().$ignoreOutbox && !this.getOptions().$ignoreJournal) {
      this.set({ $inc: { version: 1 } });
    }
    next();
  });

  // Post-save hook: Cloud -> SyncJournal, Local -> Outbox
  schema.post('save', async function(doc) {
    const rawColName = (doc.constructor?.collection?.name || doc.collection?.name || '').toLowerCase();
    if (!rawColName || IGNORED_COLLECTIONS.has(rawColName)) return;

    const colName = toSyncCollectionName(rawColName);
    if (!colName || IGNORED_COLLECTIONS.has(colName)) return;

    if (process.env.OFFLINE_MODE === 'true' || process.env.ELECTRON_APP === 'true') {
      if (doc.$ignoreOutbox) return;
      try {
        const Outbox = mongoose.models.Outbox || require('@models/Outbox');
        const syncId = doc.syncId || String(doc._id);
        const op = doc.isDeleted || doc.deletedAt ? 'DELETE' : 'UPDATE';

        await Outbox.findOneAndUpdate(
          { syncId, status: 'PENDING' },
          {
            $set: {
              eventId: uuidv4(),
              syncId,
              operation: op,
              collectionName: colName,
              payload: doc.toObject ? doc.toObject() : doc,
              version: doc.version || 1,
              status: 'PENDING',
              updatedAt: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true }
        );
      } catch (err) {
        console.warn('[Outbox] Error writing local outbox event:', err.message);
      }
    } else {
      // Cloud Backend: write to SyncJournal for desktop apps to pull
      if (doc.$ignoreJournal) return;
      try {
        const SyncJournal = mongoose.models.SyncJournal || require('@models/SyncJournal');
        await SyncJournal.create({
          syncId: doc.syncId || String(doc._id),
          operation: doc.isDeleted || doc.deletedAt ? 'DELETE' : 'UPDATE',
          collectionName: colName,
          payload: doc.toObject ? doc.toObject() : doc,
          deviceId: null,
          version: doc.version || 1,
        });
      } catch (err) {
        console.warn('[SyncJournal] Error writing cloud journal event:', err.message);
      }
    }
  });

  // Post-findOneAndUpdate hook: Cloud -> SyncJournal, Local -> Outbox
  schema.post('findOneAndUpdate', async function(res) {
    if (!res) return;
    const rawColName = (this.model?.collection?.name || this.collection?.name || '').toLowerCase();
    if (!rawColName || IGNORED_COLLECTIONS.has(rawColName)) return;

    const colName = toSyncCollectionName(rawColName);
    if (!colName || IGNORED_COLLECTIONS.has(colName)) return;

    if (process.env.OFFLINE_MODE === 'true' || process.env.ELECTRON_APP === 'true') {
      if (this.getOptions().$ignoreOutbox || res.$ignoreOutbox) return;
      try {
        const Outbox = mongoose.models.Outbox || require('@models/Outbox');
        const syncId = res.syncId || String(res._id);
        const op = res.isDeleted || res.deletedAt ? 'DELETE' : 'UPDATE';

        await Outbox.findOneAndUpdate(
          { syncId, status: 'PENDING' },
          {
            $set: {
              eventId: uuidv4(),
              syncId,
              operation: op,
              collectionName: colName,
              payload: res.toObject ? res.toObject() : res,
              version: res.version || 1,
              status: 'PENDING',
              updatedAt: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true }
        );
      } catch (err) {
        console.warn('[Outbox] Error writing local outbox event on update:', err.message);
      }
    } else {
      if (this.getOptions().$ignoreJournal || res.$ignoreJournal) return;
      try {
        const SyncJournal = mongoose.models.SyncJournal || require('@models/SyncJournal');
        await SyncJournal.create({
          syncId: res.syncId || String(res._id),
          operation: res.isDeleted || res.deletedAt ? 'DELETE' : 'UPDATE',
          collectionName: colName,
          payload: res.toObject ? res.toObject() : res,
          deviceId: null,
          version: res.version || 1,
        });
      } catch (err) {
        console.warn('[SyncJournal] Error writing cloud journal event on update:', err.message);
      }
    }
  });
}

offlineSyncPlugin.toSyncCollectionName = toSyncCollectionName;

module.exports = offlineSyncPlugin;
