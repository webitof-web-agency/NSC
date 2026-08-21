'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const axios = require('axios');
const SyncManager = require('../electron/syncManager');
const syncManagerSource = fs.readFileSync(path.join(__dirname, '../electron/syncManager.js'), 'utf8');

const mainSource = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');
const apiBaseSource = fs.readFileSync(
  path.join(__dirname, '../../Billing_Software_Frontend/src/utils/apiBaseUrl.ts'),
  'utf8',
);
const setupStatusSource = fs.readFileSync(
  path.join(__dirname, '../../Billing_Software_Frontend/src/context/SetupStatusContext.tsx'),
  'utf8',
);
const authSliceSource = fs.readFileSync(
  path.join(__dirname, '../../Billing_Software_Frontend/src/store/auth/authSlice.ts'),
  'utf8',
);
const localAuthSource = fs.readFileSync(
  path.join(__dirname, '../local-backend/controllers/authController.js'),
  'utf8',
);
const localSyncRoutesSource = fs.readFileSync(
  path.join(__dirname, '../local-backend/routes/localSyncRoutes.js'),
  'utf8',
);
const offlineSyncSource = fs.readFileSync(
  path.join(__dirname, '../local-backend/middleware/offlineSync.js'),
  'utf8',
);
const outboxControllerSource = fs.readFileSync(
  path.join(__dirname, '../local-backend/controllers/outboxController.js'),
  'utf8',
);
const localApplySource = fs.readFileSync(
  path.join(__dirname, '../local-backend/controllers/localSyncApplyController.js'),
  'utf8',
);
const localBootstrapSource = fs.readFileSync(
  path.join(__dirname, '../local-backend/controllers/localSyncBootstrapController.js'),
  'utf8',
);
const localReferenceSource = fs.readFileSync(
  path.join(__dirname, '../local-backend/utils/referenceResolver.js'),
  'utf8',
);
const cloudSyncControllerSource = fs.readFileSync(
  path.join(__dirname, '../../Billing_Software_Backend/controllers/syncController.js'),
  'utf8',
);

function createManager(userDataPath) {
  return new SyncManager({
    localBackendUrl: 'http://localhost:3002',
    remoteBackendUrl: 'https://cloud.example.test',
    deviceId: 'device-a',
    userDataPath,
  });
}

function withMockedAxios({ get, post }, run) {
  const originalGet = axios.get;
  const originalPost = axios.post;
  axios.get = get;
  axios.post = post;

  return Promise.resolve()
    .then(run)
    .finally(() => {
      axios.get = originalGet;
      axios.post = originalPost;
    });
}

test('Electron is local-first instead of switching API databases with network state', () => {
  assert.doesNotMatch(apiBaseSource, /mode === ['"]online['"]/);
  assert.match(apiBaseSource, /Electron[\s\S]*return localUrl/);
  assert.doesNotMatch(setupStatusSource, /LIVE_VERSION_URL|Trying live backend/);
  assert.match(setupStatusSource, /axios\.get\(Constants\.APP_VERSION_URL/);
});

test('the packaged backend is forced onto the MongoDB instance managed by Electron', () => {
  assert.match(mainSource, /MONGO_URI:\s*['"]mongodb:\/\/127\.0\.0\.1:27017\/nsc_local/);
});

test('the sync manager exists before the first network status callback can fire', () => {
  const lifecycle = mainSource.slice(mainSource.indexOf('app.whenReady()'));
  assert.ok(
    lifecycle.indexOf('syncManager = new SyncManager') < lifecycle.indexOf('networkMonitor.start()'),
    'initialize SyncManager before starting the immediate network check',
  );
});

test('simultaneous callers await the same active sync operation', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsc-sync-lock-'));
  const manager = createManager(tempDir);
  let finishSync;
  let runs = 0;

  manager._performSync = () => {
    runs += 1;
    return new Promise((resolve) => {
      finishSync = resolve;
    });
  };

  try {
    const first = manager.startSync();
    const second = manager.startSync();

    assert.strictEqual(second, first);
    assert.equal(runs, 1);

    finishSync({ success: true, synced: 1 });
    assert.deepEqual(await first, { success: true, synced: 1 });
    assert.equal(manager._syncPromise, null);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('packaged file sync uses a writable durable upload directory', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsc-sync-files-'));
  const manager = new SyncManager({
    localUploadsRoot: tempDir,
    userDataPath: tempDir,
  });

  try {
    assert.equal(
      manager._resolveLocalFilePath('/uploads/products/item.jpg'),
      path.join(tempDir, 'products', 'item.jpg'),
    );
    assert.throws(() => manager._resolveLocalFilePath('../outside.txt'), /outside local upload storage/);
    assert.match(mainSource, /NSC_UPLOADS_DIR:\s*LOCAL_UPLOADS_ROOT/);
    assert.match(mainSource, /localUploadsRoot:\s*LOCAL_UPLOADS_ROOT/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Electron login never replaces the cloud sync credential with a local JWT', () => {
  assert.doesNotMatch(authSliceSource, /api\/local\/sync-token/);
  assert.match(authSliceSource, /electronAPI\?\.triggerSync/);
  assert.match(localAuthSource, /ensureCloudSyncToken/);
});

test('a cloud-verified first login stores a stable identity and an offline-capable password', () => {
  assert.match(localAuthSource, /cloudUser\.syncId\s*=\s*`mongo:\$\{cloudUser\._id\}`/);
  assert.match(localAuthSource, /cloudUser\.password\s*=\s*await bcrypt\.hash\(password,\s*12\)/);
});

test('expired cloud credentials can be removed instead of remaining stuck forever', () => {
  assert.match(localSyncRoutesSource, /deleteMany\(\{\s*key:\s*\{\s*\$in:\s*\[['"]syncToken['"],\s*['"]syncTokenEmail['"]\]/);
});

test('each local mutation advances the document version used for multi-PC conflicts', () => {
  assert.match(offlineSyncSource, /isDeleted/);
  assert.match(offlineSyncSource, /if \(!this\.isNew && !this\.\$ignoreOutbox\)[\s\S]*this\.version\s*=\s*\(this\.version \|\| 0\) \+ 1/);
  assert.match(offlineSyncSource, /pre\(['"]findOneAndUpdate['"][\s\S]*\$inc[\s\S]*version/);
});

test('new syncable to-do records use soft deletion so other PCs receive the delete', () => {
  const todoSource = fs.readFileSync(
    path.join(__dirname, '../local-backend/controllers/todoController.js'),
    'utf8',
  );
  assert.doesNotMatch(todoSource, /findOneAndDelete/);
  assert.match(todoSource, /isDeleted/);
});

test('bootstrap reads the cloud data envelope and applies its snapshot locally', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsc-sync-bootstrap-'));
  const manager = createManager(tempDir);
  const snapshot = { customers: [{ syncId: 'customer-1', name: 'Customer' }] };
  let appliedSnapshot = null;

  try {
    await withMockedAxios({
      get: async (url) => {
        assert.equal(url, 'https://cloud.example.test/api/sync/bootstrap');
        return { data: { success: true, data: { snapshot, cursor: 'cursor-10' } } };
      },
      post: async (url, body) => {
        assert.equal(url, 'http://localhost:3002/api/local/sync-bootstrap');
        appliedSnapshot = body.snapshot;
        return { data: { success: true } };
      },
    }, () => manager._bootstrapSync('auth-token'));

    assert.deepEqual(appliedSnapshot, snapshot);
    assert.equal(manager._getCursor(), 'cursor-10');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('pull reads the cloud data envelope and applies each event using the local endpoint contract', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsc-sync-pull-'));
  const manager = createManager(tempDir);
  const events = [
    { syncId: 'invoice-1', collectionName: 'invoices', operation: 'UPDATE', version: 2, payload: {} },
    { syncId: 'customer-1', collectionName: 'customers', operation: 'UPDATE', version: 3, payload: {} },
  ];
  const appliedEvents = [];
  manager._setCursor('cursor-10');

  try {
    await withMockedAxios({
      get: async (url) => {
        assert.match(url, /^https:\/\/cloud\.example\.test\/api\/sync\/pull\?/);
        return { data: { success: true, data: { events, nextCursor: 'cursor-12', hasMore: false } } };
      },
      post: async (url, body) => {
        assert.equal(url, 'http://localhost:3002/api/local/sync-apply');
        assert.ok(body.event, 'local sync apply requires one event per request');
        appliedEvents.push(body.event);
        return { data: { success: true } };
      },
    }, () => manager._pullSync('auth-token'));

    assert.deepEqual(appliedEvents, events);
    assert.equal(manager._getCursor(), 'cursor-12');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('pull failures are surfaced instead of reporting a successful sync', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsc-sync-error-'));
  const manager = createManager(tempDir);
  manager._setCursor('cursor-10');

  try {
    await assert.rejects(
      withMockedAxios({
        get: async () => {
          throw new Error('cloud unavailable');
        },
        post: async () => {
          throw new Error('unexpected local request');
        },
      }, () => manager._pullSync('auth-token')),
      /cloud unavailable/,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('push stamps every event with the permanent Electron device id', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsc-sync-push-'));
  const manager = createManager(tempDir);
  const event = {
    eventId: 'event-1',
    syncId: 'invoice-1',
    operation: 'UPDATE',
    collectionName: 'invoices',
    payload: {},
    version: 1,
  };

  try {
    await withMockedAxios({
      get: async (url) => {
        assert.equal(url, 'http://localhost:3002/api/outbox/pending?limit=500');
        return { data: { success: true, data: [event] } };
      },
      post: async (url, body) => {
        if (url === 'https://cloud.example.test/api/sync/push') {
          assert.equal(body.events[0].deviceId, 'device-a');
          return { data: { success: true, processedEvents: ['event-1'], conflicts: [] } };
        }
        assert.equal(url, 'http://localhost:3002/api/outbox/mark-synced');
        assert.deepEqual(body.eventIds, ['event-1']);
        return { data: { success: true } };
      },
    }, () => manager._pushSync('auth-token'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('failed push batches surface an error and multi-PC polling is not delayed for five minutes', () => {
  assert.match(syncManagerSource, /retries >= 5[\s\S]*throw batchErr/);
  assert.match(syncManagerSource, /30 \* 1000/);
  assert.doesNotMatch(syncManagerSource, /5 \* 60 \* 1000/);
});

test('new local outbox events default to pending and legacy pending events remain readable', () => {
  const Outbox = require('../local-backend/models/Outbox');
  const event = new Outbox({
    eventId: 'event-1',
    syncId: 'invoice-1',
    operation: 'UPDATE',
    collectionName: 'invoices',
    payload: {},
    version: 1,
  });

  assert.equal(event.status, 'PENDING');
  assert.match(outboxControllerSource, /processed:\s*\{\s*\$ne:\s*true/);
  assert.match(outboxControllerSource, /status:\s*['"]SYNCED['"]/);
  assert.match(outboxControllerSource, /processed:\s*true/);
});

test('cloud journal entries always receive a unique cursor value', () => {
  const SyncJournal = require('../../Billing_Software_Backend/models/SyncJournal');
  const event = new SyncJournal({
    syncId: 'invoice-1',
    operation: 'UPDATE',
    collectionName: 'invoices',
    payload: {},
    version: 1,
  });

  assert.equal(event.validateSync(), undefined);
  assert.ok(event.cursor);
});

test('cloud sync credentials are cached per user and refreshed through cloud login', async () => {
  const { ensureCloudSyncToken } = require('../local-backend/services/cloudSyncAuthService');
  const values = new Map();
  const tokenStore = {
    findOne: async ({ key }) => values.has(key) ? { value: values.get(key) } : null,
    findOneAndUpdate: async ({ key }, { value }) => values.set(key, value),
  };
  const httpClient = {
    post: async (url, credentials) => {
      assert.equal(url, 'https://cloud.example.test/api/auth/login');
      assert.deepEqual(credentials, { email: 'admin@example.test', password: 'secret' });
      return { data: { token: 'cloud-token', user: { email: 'admin@example.test' } } };
    },
  };

  const result = await ensureCloudSyncToken({
    email: 'admin@example.test',
    password: 'secret',
    remoteBackendUrl: 'https://cloud.example.test',
    httpClient,
    tokenStore,
  });

  assert.equal(result.token, 'cloud-token');
  assert.equal(values.get('syncToken'), 'cloud-token');
  assert.equal(values.get('syncTokenEmail'), 'admin@example.test');
});

test('bootstrap and incremental pull cover the complete offline billing dataset', () => {
  const collectionNames = [
    'users', 'customers', 'suppliers', 'products', 'product-variants',
    'categories', 'brands', 'units', 'tax-groups', 'tax-rates',
    'company-details', 'bank-details', 'signatures', 'payment-modes',
    'invoices', 'quotations', 'credit-notes', 'purchases',
    'supplier-payments', 'attendance', 'staff-salary',
    'customer-portal-branding', 'legal-settings', 'qr-settings',
    'notifications', 'todo-tasks',
  ];
  const registryNames = require('../electron/syncRegistry').map(({ name }) => name);

  assert.deepEqual(registryNames, collectionNames);
  for (const collectionName of collectionNames) {
    for (const source of [localApplySource, localBootstrapSource, localReferenceSource]) {
      assert.match(source, new RegExp(`['"]${collectionName}['"]`));
    }
  }
});

test('all offline billing models generate sync IDs and outbox events', () => {
  const modelNames = [
    'Product', 'ProductVariant', 'Category', 'Brand', 'Unit', 'TaxGroup',
    'TaxRate', 'CompanySettings', 'BankDetail', 'Signature', 'PaymentMode',
    'CustomerPortalBranding', 'LegalSettings', 'QrSettings', 'Notification',
    'TodoTask',
  ];

  for (const modelName of modelNames) {
    const localSource = fs.readFileSync(
      path.join(__dirname, `../local-backend/models/${modelName}.js`),
      'utf8',
    );
    const cloudSource = fs.readFileSync(
      path.join(__dirname, `../../Billing_Software_Backend/models/${modelName}.js`),
      'utf8',
    );
    assert.match(localSource, /plugin\(offlineSyncPlugin\)/, `${modelName} is not queued locally`);
    assert.match(cloudSource, /plugin\(offlineSyncPlugin\)/, `${modelName} has no cloud sync identity`);
  }
});

test('cloud bootstrap backfills stable IDs and orders dependencies before invoices', () => {
  assert.match(cloudSyncControllerSource, /backfillMissingSyncIds/);
  assert.match(cloudSyncControllerSource, /isDeleted:\s*\{\s*\$ne:\s*true/);
  assert.match(cloudSyncControllerSource, /ZERO_SYNC_CURSOR/);
  const snapshotSource = cloudSyncControllerSource.slice(
    cloudSyncControllerSource.indexOf('const snapshot = {'),
    cloudSyncControllerSource.indexOf('res.status(200).json', cloudSyncControllerSource.indexOf('const snapshot = {')),
  );
  assert.ok(
    snapshotSource.indexOf("'product-variants': productVariants")
      < snapshotSource.indexOf('invoices,'),
    'catalog records must be inserted locally before invoice references are resolved',
  );
});

test('outbox events use the canonical collection names accepted by cloud sync', () => {
  const offlineSyncPlugin = require('../local-backend/middleware/offlineSync');
  const cases = {
    productvariants: 'product-variants',
    taxgroups: 'tax-groups',
    taxrates: 'tax-rates',
    companysettings: 'company-details',
    bankdetails: 'bank-details',
    paymentmodes: 'payment-modes',
    creditnotes: 'credit-notes',
    supplierpayments: 'supplier-payments',
    staffsalaries: 'staff-salary',
  };

  for (const [mongooseName, syncName] of Object.entries(cases)) {
    assert.equal(offlineSyncPlugin.toSyncCollectionName(mongooseName), syncName);
  }
});
