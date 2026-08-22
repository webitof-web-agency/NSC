// local-backend/server.js
// Embedded Express server for offline mode
// Runs on 127.0.0.1:3002 inside the Electron app
// Connects to local MongoDB (Compass) instead of Atlas

'use strict';

const path = require('path');
const fs = require('fs');

// ── Auto-discover and register unpacked node_modules for production standalone execution ──
const candidateModulePaths = [
  path.join(__dirname, '../app.asar.unpacked/node_modules'),
  path.join(__dirname, '../app.asar/node_modules'),
  path.join(__dirname, '../node_modules'),
  path.join(__dirname, '../../node_modules'),
  ...(process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [])
];

candidateModulePaths.forEach(p => {
  if (p && fs.existsSync(p)) {
    if (!module.paths.includes(p)) {
      module.paths.unshift(p);
    }
    const Module = require('module');
    if (Module.globalPaths && !Module.globalPaths.includes(p)) {
      Module.globalPaths.unshift(p);
    }
  }
});

// ── Module Aliases ──────────────────────────────────────────
const moduleAlias = require('module-alias');
moduleAlias.addAliases({
  '@': __dirname,
  '@controllers': __dirname + '/controllers',
  '@middleware': __dirname + '/middleware',
  '@models': __dirname + '/models',
  '@routes': __dirname + '/routes',
  '@utils': __dirname + '/utils',
  '@validators': __dirname + '/validators'
});

// ── Load .env.local ──────────────────────────────────────────
const envFilePath = process.env.ENV_FILE_PATH || (__dirname + '/.env.local');
console.log('📄 Loading env from:', envFilePath);
require('dotenv').config({ path: envFilePath });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const localSyncRoutes = require('./routes/localSyncRoutes');
const outboxRoutes = require('./routes/outboxRoutes');

// ─────────────────────────────────────────────
// Environment for offline mode
// ─────────────────────────────────────────────
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nsc_local';
process.env.JWT_SECRET = process.env.JWT_SECRET || '557330fb621a1e17be7bc45ff7ccb230_local';
process.env.BASE_URL    = process.env.BASE_URL || 'http://127.0.0.1:3002';
process.env.NODE_ENV    = 'production';
process.env.OFFLINE_MODE = 'true';

const PORT = parseInt(process.env.PORT || '3002', 10);

// ─────────────────────────────────────────────
// Global error handlers
// ─────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('❌ Local backend unhandled rejection:', err?.message);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Local backend uncaught exception:', err?.message);
});

// ─────────────────────────────────────────────
// Express App Initialization
// ─────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id'],
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Static files (uploads, PDF templates)
const { getUploadsRoot, ensureUploadDir } = require('./utils/storagePaths');
const uploadsPath = ensureUploadDir();
app.use('/uploads', express.static(uploadsPath));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
// Health Check Route (used by wait-on & Electron main)
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  const mongoState = mongoose.connection.readyState;
  res.status(mongoState === 1 ? 200 : 200).json({
    status: mongoState === 1 ? 'ok' : 'initializing',
    service: 'nsc-local-backend',
    mode: 'offline-first',
    port: PORT,
    mongoConnected: mongoState === 1,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
// Register API Routes
// ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/local', localSyncRoutes);
app.use('/api/outbox', outboxRoutes);

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Local endpoint ${req.method} ${req.originalUrl} not found`,
  });
});

// ─────────────────────────────────────────────
// Start Server & Connect MongoDB with Retries
// ─────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 NSC Local Backend running at http://127.0.0.1:${PORT}`);
  console.log(`📦 Serving static files from: ${uploadsPath}`);
  console.log(`📡 Ready for local Electron requests`);
  console.log(`BACKEND_READY`);
});

async function initDB() {
  try {
    await connectDB();
  } catch (err) {
    console.warn(`⚠️ Local MongoDB initial connection pending: ${err.message}. Retrying in 3s...`);
    setTimeout(initDB, 3000);
  }
}
initDB();
