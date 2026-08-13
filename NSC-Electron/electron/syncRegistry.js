// electron/syncRegistry.js
'use strict';

/**
 * Central registry of all syncable collections.
 * Order matters! Collections with no dependencies (like users, customers, suppliers)
 * should sync before collections that reference them (like invoices, purchases).
 */
const SyncRegistry = [
  { name: 'users',             endpoint: '/api/admin/users',             localEndpoint: '/api/local/unsynced/users' },
  { name: 'customers',         endpoint: '/api/admin/customers',         localEndpoint: '/api/local/unsynced/customers' },
  { name: 'suppliers',         endpoint: '/api/admin/suppliers',         localEndpoint: '/api/local/unsynced/suppliers' },
  { name: 'invoices',          endpoint: '/api/admin/invoices',          localEndpoint: '/api/local/unsynced/invoices' },
  { name: 'quotations',        endpoint: '/api/admin/quotations',        localEndpoint: '/api/local/unsynced/quotations' },
  { name: 'credit-notes',      endpoint: '/api/admin/credit-notes',      localEndpoint: '/api/local/unsynced/credit-notes' },
  { name: 'purchases',         endpoint: '/api/admin/purchases',         localEndpoint: '/api/local/unsynced/purchases' },
  { name: 'supplier-payments', endpoint: '/api/admin/supplier-payments', localEndpoint: '/api/local/unsynced/supplier-payments' },
  { name: 'attendance',        endpoint: '/api/admin/attendance',        localEndpoint: '/api/local/unsynced/attendance' },
  { name: 'staff-salary',      endpoint: '/api/admin/staff-salary',      localEndpoint: '/api/local/unsynced/staff-salary' },
];

module.exports = SyncRegistry;
