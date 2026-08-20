// electron/main.js
// Main process: Window management, backend spawning, network monitoring, IPC

'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const NetworkMonitor = require('./networkMonitor');
const SyncManager = require('./syncManager');

/**
 * Parse a .env style file and return key-value pairs.
 * Handles comments (#), blank lines, and quoted values.
 */
function parseEnvFile(filePath) {
  const result = {};
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      result[key] = val;
    }
  } catch {
    // File not found or unreadable — will use defaults
  }
  return result;
}

const isDev = process.argv.includes('--dev');
const RENDERER_PORT = 3000;      // Optional Vite dev server
const LOCAL_BACKEND_PORT = 3002; // Embedded Express
const rendererIndexPath = path.join(__dirname, '../renderer/index.html');

function shouldUseDevServer() {
  return isDev && !!process.env.ELECTRON_RENDERER_URL;
}

let mainWindow = null;
let localBackendProcess = null;
let networkMonitor = null;
let syncManager = null;

// ─────────────────────────────────────────────
// 1. Launch Local Express Backend
// ─────────────────────────────────────────────
function startLocalBackend() {
  return new Promise((resolve, reject) => {
    // ── Path Resolution ──────────────────────────────────────────────
    // In development:  local-backend/ is alongside electron/ in the source tree
    // In production:   local-backend/ is in process.resourcesPath (extraResources)
    //                  because files inside app.asar CANNOT be fork()'d
    const backendDir = isDev
      ? path.join(__dirname, '../local-backend')
      : path.join(process.resourcesPath, 'local-backend');

    const serverScript = path.join(backendDir, 'server.js');
    const envFile = path.join(backendDir, '.env.local');

    // ── Node modules path ─────────────────────────────────────────────
    // In dev: project root node_modules
    // In production: unpacked node_modules outside ASAR
    const unpackedModules = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules');
    const asarModules = path.join(app.getAppPath(), 'node_modules');
    const localBackendModules = path.join(backendDir, 'node_modules');

    const nodeModulesPath = isDev
      ? path.join(__dirname, '../node_modules')
      : (fs.existsSync(unpackedModules) ? unpackedModules : asarModules);

    const fullNodePath = [
      nodeModulesPath,
      localBackendModules,
      unpackedModules,
      asarModules
    ].filter(Boolean).join(path.delimiter);

    console.log('📂 Backend dir:', backendDir);
    console.log('📄 Server script:', serverScript);
    console.log('📄 Env file:', envFile);
    console.log('📦 node_modules path:', fullNodePath);

    // ── Use Electron's bundled Node.js executable ─────────────────────
    // This ensures the app works on machines that DON'T have Node.js installed
    const nodeExe = process.execPath; // This is Electron itself (which IS Node.js)

    localBackendProcess = spawn(
      nodeExe,
      [serverScript],
      {
        env: {
          ...process.env,
          PORT: String(LOCAL_BACKEND_PORT),
          BASE_URL: `http://localhost:${LOCAL_BACKEND_PORT}`,
          NODE_ENV: 'production',
          ELECTRON_APP: 'true',
          ENV_FILE_PATH: envFile,
          ELECTRON_RUN_AS_NODE: '1',
          // Tell Node.js where node_modules are (critical for production)
          NODE_PATH: fullNodePath,
        },
        cwd: backendDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    localBackendProcess.stdout.on('data', (data) => {
      const line = data.toString().trim();
      console.log(`[Backend] ${line}`);
      // Detect when the server is ready
      if (line.includes('BACKEND_READY') || line.includes('running at http://localhost')) {
        console.log('✅ Local backend is ready on port', LOCAL_BACKEND_PORT);
        resolve();
      }
    });

    localBackendProcess.stderr.on('data', (data) => {
      console.error(`[Backend ERR] ${data.toString().trim()}`);
    });

    localBackendProcess.on('error', (err) => {
      console.error('❌ Local backend failed to start:', err);
      reject(err);
    });

    localBackendProcess.on('exit', (code) => {
      console.log(`⚠️  Local backend exited with code ${code}`);
    });

    // Fallback: resolve after 8 seconds even if no ready message
    setTimeout(() => {
      console.log('⏱️  Backend startup timeout reached — continuing anyway');
      resolve();
    }, 8000);
  });
}

// ─────────────────────────────────────────────
// 2. Create the Main BrowserWindow
// ─────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Naresh Saree Collection — Billing',
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,     // Security: isolate renderer context
      nodeIntegration: false,     // Security: no node in renderer
      sandbox: false,             // Allow preload to access Node APIs
      webSecurity: true,
    },
    backgroundColor: '#0f172a',  // Dark background while loading
    show: false,                  // Show after ready-to-show
    titleBarStyle: 'default',
  });

  // Remove default menu bar (we'll rely on the app's own UI)
  Menu.setApplicationMenu(null);

  // Load the React app
  if (shouldUseDevServer()) {
    const rendererUrl = process.env.ELECTRON_RENDERER_URL || `http://localhost:${RENDERER_PORT}`;
    console.log(`?? Loading renderer from dev server: ${rendererUrl}`);
    mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools();
  } else {
    console.log(`?? Loading renderer from file: ${rendererIndexPath}`);
    mainWindow.loadFile(rendererIndexPath);
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in system browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

// ─────────────────────────────────────────────
// 3. IPC Handlers
// ─────────────────────────────────────────────
function setupIPC() {
  // Renderer asks for current connection mode
  ipcMain.handle('get:connection-mode', () => {
    return networkMonitor ? networkMonitor.getStatus() : { isOnline: false, mode: 'offline' };
  });

  // Renderer asks for current sync status
  ipcMain.handle('get:sync-status', () => {
    return syncManager ? syncManager.getStatus() : { pending: 0, lastSync: null };
  });

  // Renderer manually triggers a sync
  ipcMain.handle('trigger:sync', async () => {
    if (syncManager && networkMonitor && networkMonitor.getStatus().isOnline) {
      return syncManager.startSync();
    }
    return { success: false, message: 'Offline or sync manager not ready' };
  });

  // Renderer asks for the local backend port
  ipcMain.handle('get:local-backend-port', () => LOCAL_BACKEND_PORT);

  // Handle print dialog
  ipcMain.handle('print:page', () => {
    if (mainWindow) {
      mainWindow.webContents.print({}, (success, failureReason) => {
        if (!success) console.error('Print failed:', failureReason);
      });
    }
  });
}

// ─────────────────────────────────────────────
// 4. Network Monitor Callbacks
// ─────────────────────────────────────────────
function onNetworkChange(status) {
  console.log(`🌐 Network status changed: ${status.mode.toUpperCase()}`);
  
  // Notify renderer process
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('network:status', status);
  }

  // When coming back online — only sync if auth token is already cached
  // (prevents 401 errors on startup before the user has logged in)
  if (status.isOnline && syncManager) {
    syncManager.hasAuthToken().then((hasToken) => {
      if (hasToken) {
        console.log('🔄 Back online — starting sync...');
        syncManager.startSync().catch(console.error);
        syncManager.startPeriodicSync();
      } else {
        console.log('⏸️  Back online but no auth token yet — sync will run after login');
      }
    }).catch(console.error);
  } else if (!status.isOnline && syncManager) {
    syncManager.stopPeriodicSync();
  }
}

function onSyncProgress(progress) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sync:status', progress);
  }
}

// ─────────────────────────────────────────────
// 5. App Lifecycle
// ─────────────────────────────────────────────
const MongoDBManager = require('./mongodbManager');
let mongoManager = null;

app.whenReady().then(async () => {
  console.log('🚀 NSC Desktop App starting...');

  try {
    // Step 0: Start MongoDB
    mongoManager = new MongoDBManager(app);
    await mongoManager.start();

    // Step 1: Start local backend
    console.log('⏳ Starting local backend...');
    await startLocalBackend();

    // Step 2: Setup IPC handlers
    setupIPC();

    // Step 3: Create window
    createWindow();

    // Step 4: Start network monitor
    networkMonitor = new NetworkMonitor({
      checkInterval: 8000,      // Check every 8 seconds
      onStatusChange: onNetworkChange,
    });
    networkMonitor.start();

    // Step 5: Init sync manager
    // Read REMOTE_BACKEND_URL from local-backend/.env.local so it's configurable without rebuilding
    const envFilePath = isDev
      ? path.join(__dirname, '../local-backend/.env.local')
      : path.join(process.resourcesPath, 'local-backend/.env.local');
    const envConfig = parseEnvFile(envFilePath);
    const remoteBackendUrl = envConfig.REMOTE_BACKEND_URL || 'https://server.nareshsareecollection.com';
    console.log('🔗 Sync target:', remoteBackendUrl);

    const DeviceIdManager = require('./deviceIdManager');
    const deviceIdManager = new DeviceIdManager(app);
    const deviceId = deviceIdManager.getDeviceId();

    syncManager = new SyncManager({
      localBackendUrl: `http://localhost:${LOCAL_BACKEND_PORT}`,
      remoteBackendUrl,
      deviceId, // ── Phase 4: Device Identity ──
      userDataPath: app.getPath('userData'), // Pass userData path for cursor storage
      onProgress: onSyncProgress,
    });

    // Step 6: Auto-updater (for future production builds)
    if (!isDev && process.platform === 'win32') {
      // autoUpdater.checkForUpdatesAndNotify();
      // Will be enabled when update server is configured
    }

  } catch (err) {
    console.error('❌ Fatal error during startup:', err);
    dialog.showErrorBox(
      'Startup Error',
      `Failed to start NSC Desktop App:\n${err.message}\n\nPlease ensure MongoDB is running locally.`
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Kill local backend
  if (localBackendProcess) {
    localBackendProcess.kill('SIGTERM');
    localBackendProcess = null;
  }
  // Stop network monitor
  if (networkMonitor) {
    networkMonitor.stop();
  }
  // Stop MongoDB
  if (mongoManager) {
    mongoManager.stop();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (localBackendProcess) {
    localBackendProcess.kill('SIGTERM');
  }
  if (networkMonitor) {
    networkMonitor.stop();
  }
  if (mongoManager) {
    mongoManager.stop();
  }
});
