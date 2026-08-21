'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const electronRoot = path.resolve(__dirname, '..');
const localRoot = path.join(electronRoot, 'local-backend');
const cloudRoot = path.resolve(electronRoot, '../Billing_Software_Backend');
const frontendRoot = path.resolve(electronRoot, '../Billing_Software_Frontend');

function read(relativePath, root = localRoot) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function listJavaScriptFiles(relativeDirectory) {
  const directory = path.join(cloudRoot, relativeDirectory);
  const result = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      result.push(...listJavaScriptFiles(relativePath));
    } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      result.push(relativePath);
    }
  }

  return result;
}

function routeSignatures(relativePath, root = cloudRoot) {
  const source = read(relativePath, root);
  return [...source.matchAll(/router\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g)]
    .map((match) => `${match[1].toUpperCase()} ${match[3]}`);
}

test('Electron local backend contains every current portable backend module', () => {
  const sourceDirectories = [
    'config',
    'controllers',
    'middleware',
    'models',
    'routes',
    'services',
    'utils',
    'validators',
    'whatsapp-module',
  ];
  const intentionallyCloudOnly = new Set([
    'config/db.js',
    'controllers/syncController.js',
    'models/SyncConflict.js',
    'models/SyncJournal.js',
    'routes/syncRoutes.js',
  ]);

  const missing = sourceDirectories
    .flatMap(listJavaScriptFiles)
    .filter((relativePath) => !intentionallyCloudOnly.has(relativePath))
    .filter((relativePath) => !fs.existsSync(path.join(localRoot, relativePath)));

  assert.deepEqual(missing, [], `Missing portable backend files:\n${missing.join('\n')}`);
});

test('Electron exposes all current admin and authentication route signatures', () => {
  for (const relativePath of ['routes/adminRoutes.js', 'routes/authRoutes.js']) {
    const localRoutes = new Set(routeSignatures(relativePath, localRoot));
    const missingRoutes = routeSignatures(relativePath).filter((signature) => !localRoutes.has(signature));

    assert.deepEqual(missingRoutes, [], `${relativePath} is missing current backend routes`);
  }
});

test('Electron server mounts current local-safe APIs and keeps centralized integrations remote', () => {
  const serverSource = read('server.js');

  assert.match(serverSource, /app\.use\(['"]\/api\/customer['"],\s*customerRoutes\)/);
  assert.match(serverSource, /app\.use\(['"]\/api\/public['"],\s*publicRoutes\)/);
  assert.match(serverSource, /app\.use\(['"]\/api\/admin\/whatsapp['"],\s*protect,\s*cloudApiProxy/);
  assert.match(serverSource, /app\.use\(['"]\/api\/local['"],\s*localSyncRoutes\)/);
  assert.match(serverSource, /app\.use\(['"]\/api\/outbox['"],\s*outboxRoutes\)/);

  assert.doesNotMatch(serverSource, /app\.use\(['"]\/api\/sync['"]/);
  assert.doesNotMatch(serverSource, /attendanceAutoCheckoutCron|invoiceCreditNotificationCron|variantRetentionCron|whatsappStatusSyncCron/);
  assert.doesNotMatch(serverSource, /\/api\/whatsapp\/webhook/);
});

test('Electron keeps its durable storage, local database, and cloud credential adapters', () => {
  const serverSource = read('server.js');
  const packageJson = JSON.parse(read('package.json'));

  assert.match(serverSource, /NSC_UPLOADS_DIR|getUploadsRoot/);
  assert.match(read('config/db.js'), /127\.0\.0\.1|localhost/);
  assert.match(read('controllers/authController.js'), /ensureCloudSyncToken/);
  assert.match(read('middleware/offlineSync.js'), /Outbox/);
  assert.doesNotMatch(read('middleware/authMiddleware.js'), /jwt\.decode|CLOUD_JWT_SECRET/);
  assert.equal(packageJson._moduleAliases['@services'], 'services');
});

test('central WhatsApp sending accepts stable sync IDs forwarded by Electron', () => {
  const proxySource = read('middleware/cloudApiProxy.js');
  const cloudWhatsAppSource = read('whatsapp-module/services/whatsappService.js', cloudRoot);

  assert.match(proxySource, /documentId:\s*document\.syncId/);
  assert.match(cloudWhatsAppSource, /buildDocumentLookup/);
  assert.match(cloudWhatsAppSource, /syncId/);
});

test('cloud document lookup distinguishes Mongo IDs from Electron sync IDs', () => {
  const { buildDocumentLookup } = require('../../Billing_Software_Backend/whatsapp-module/services/whatsappService');

  assert.deepEqual(buildDocumentLookup('64f000000000000000000001', 'user-1'), {
    _id: '64f000000000000000000001',
    userId: 'user-1',
    isDeleted: false,
  });
  assert.deepEqual(buildDocumentLookup('invoice-sync-id', 'user-1'), {
    syncId: 'invoice-sync-id',
    userId: 'user-1',
    isDeleted: false,
  });
});

test('Electron document sends finish pending sync before calling centralized WhatsApp', () => {
  const syncManagerSource = fs.readFileSync(path.join(electronRoot, 'electron/syncManager.js'), 'utf8');
  const helperSource = fs.readFileSync(path.join(frontendRoot, 'src/utils/syncBeforeCloudAction.ts'), 'utf8');
  const sendSurfaces = [
    'src/pages/admin/invoices/CreateInvoice.tsx',
    'src/pages/admin/invoices/InvoiceList.tsx',
    'src/pages/admin/invoices/ViewInvoice.tsx',
    'src/pages/admin/quotations/QuotationList.tsx',
    'src/pages/admin/quotations/ViewQuotation.tsx',
  ];

  assert.match(syncManagerSource, /_syncPromise/);
  assert.match(helperSource, /triggerSync/);
  for (const relativePath of sendSurfaces) {
    const source = fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
    assert.match(source, /syncBeforeCloudAction/);
  }
});

test('Electron retains current exchange payment behavior for unpaid invoices', () => {
  const invoiceController = read('controllers/Admin/Invoice/invoiceController.js');

  assert.match(invoiceController, /\["EXCHANGE", "PARTIALLY_PAID", "PAID", "PENDING", "UNPAID"\]/);
  assert.match(invoiceController, /existingPayment\s*=\s*await InvoicePayment\.create/);
  assert.match(invoiceController, /const invoiceTotal\s*=\s*toMoney/);
  assert.match(invoiceController, /const totalPaid\s*=\s*toMoney/);
});
