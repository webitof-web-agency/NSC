// electron-builder.config.js
// Packaging configuration for Windows .exe NSIS installer with auto-update support

'use strict';

const pkg = require('./package.json');

/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  // ─────────────────────────────────────────────
  // App metadata
  // ─────────────────────────────────────────────
  appId: 'com.nareshsareecollection.desktop',
  productName: 'NSCBilling',
  copyright: `Copyright © ${new Date().getFullYear()} Naresh Saree Collection`,

  asar: true,
  asarUnpack: [
    '**/node_modules/**/*',
  ],

  // ─────────────────────────────────────────────
  // Files to include in the ASAR package
  // NOTE: local-backend is NOT here — it's in extraResources below
  // because child_process.fork() cannot run scripts from inside an ASAR archive
  // ─────────────────────────────────────────────
  files: [
    // Electron main process files
    'electron/**/*',
    // Built React app (must run build:frontend first)
    'renderer/**/*',
    // Root package.json only
    'package.json',
    // Exclude dev-only and large unnecessary files
    '!node_modules/.cache/**',
    '!**/*.map',
    '!**/.git/**',
  ],

  // ─────────────────────────────────────────────
  // Extra Resources: placed OUTSIDE the ASAR archive
  // These are real files on disk that Node.js can fork() and require()
  // ─────────────────────────────────────────────
  extraResources: [
    {
      from: 'assets/',
      to: 'assets/',
      filter: ['**/*'],
    },
    {
      // The entire local-backend folder goes here, outside ASAR
      // In production: process.resourcesPath + '/local-backend/'
      from: 'local-backend/',
      to: 'local-backend/',
      // Include regular files plus dotfiles like .env.local in one pass
      filter: ['**/*', '**/.*', '.env.local'],
    },
    {
      // Bundled MongoDB Community Server binary (mongod.exe)
      // Placed outside ASAR so it can be spawned as a child process
      from: 'mongodb-bin/',
      to: 'mongodb-bin/',
      filter: ['**/*'],
    },
  ],

  // ─────────────────────────────────────────────
  // Windows NSIS Installer
  // ─────────────────────────────────────────────
  win: {
    target: [
      {
        target: 'nsis',          // Full installer
        arch: ['x64'],          // 64-bit only
      },
    ],
    icon: 'assets/icon.ico',    // App icon (.ico format, 256x256)
    requestedExecutionLevel: 'asInvoker', // No UAC prompt needed
  },

  nsis: {
    oneClick: false,              // Show install wizard (not silent)
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'NSC Billing',
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    // installerHeader: 'assets/installer-header.bmp',  // Optional: 150x57 BMP
    // license: 'assets/license.txt',                   // Optional: license shown during install
    // include: 'assets/installer.nsh',                 // Optional: custom NSIS script
    deleteAppDataOnUninstall: false,                  // Preserve user data on uninstall
    
    // ── Prerequisite check: MongoDB must be installed ──
    // The installer.nsh file can check for MongoDB service
  },

  // ─────────────────────────────────────────────
  // Linux Targets
  // ─────────────────────────────────────────────
  linux: {
    target: ['AppImage'],
    category: 'Office',
    icon: 'assets/icon.png',
    executableName: 'nsc-billing',
  },

  // ─────────────────────────────────────────────
  // Auto-updater (for future use with auto-update server)
  // ─────────────────────────────────────────────
  publish: {
    provider: 'generic',
    // url: 'https://your-update-server.com/releases/',
    // When you have an update server, uncomment and set the URL above
    // electron-builder will publish updates there, and the app will auto-check
    url: 'https://updates.nareshsareecollection.com/NSC-Billing/',
  },

  // ─────────────────────────────────────────────
  // Output directory
  // ─────────────────────────────────────────────
  directories: {
    output: 'release',            // ./release/ folder will contain the .exe
    buildResources: 'assets',
    app: '.',
  },

  // ─────────────────────────────────────────────
  // Build hooks
  // ─────────────────────────────────────────────
  afterSign: async (context) => {
    // Code signing can be added here in the future
    console.log('✅ Build complete. Output dir:', context.outDir);
  },
};
