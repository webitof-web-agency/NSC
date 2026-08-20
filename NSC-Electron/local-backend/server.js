// local-backend/server.js
// Embedded Express server for offline mode
// Runs on localhost:3002 inside the Electron app
// Connects to local MongoDB (Compass) instead of Atlas

'use strict';

// Ensure NODE_PATH directories are added to module search paths
if (process.env.NODE_PATH) {
  require('module').Module._initPaths();
}

// ── Module Aliases ──────────────────────────────────────────
// __dirname always points to the local-backend/ directory regardless of how
// server.js is launched (dev: node local-backend/server.js, prod: spawn from extraResources)
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
// In production: ENV_FILE_PATH is passed by main.js from resourcesPath
// In dev: falls back to __dirname/.env.local (correct path)
const envFilePath = process.env.ENV_FILE_PATH || (__dirname + '/.env.local');
console.log('📄 Loading env from:', envFilePath);
require('dotenv').config({ path: envFilePath });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const localSyncRoutes = require('./routes/localSyncRoutes'); // NEW: Sync management routes
const outboxRoutes = require('./routes/outboxRoutes');

// ─────────────────────────────────────────────
// Environment for offline mode
// ─────────────────────────────────────────────
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nsc_local';
process.env.JWT_SECRET = process.env.JWT_SECRET || '557330fb621a1e17be7bc45ff7ccb230_local';
process.env.BASE_URL    = process.env.BASE_URL || 'http://localhost:3002';
process.env.NODE_ENV    = 'production';
process.env.OFFLINE_MODE = 'true'; // Flag for offline-aware logic

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

const app = express();

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────
app.use(cors({
  origin: true, // Allow all origins (Electron loads from file:// or localhost)
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files from local storage
const uploadsDir = path.join(require('os').homedir(), '.nsc-desktop', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    mode: 'offline',
    server: 'local',
    db: states[mongoose.connection.readyState],
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'NSC Local Backend (Offline Mode) ✅',
    mode: 'offline',
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/local', localSyncRoutes); // Sync management endpoint
app.use('/api/outbox', outboxRoutes);

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────
async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, '127.0.0.1', () => {
      console.log(`✅ NSC Local Backend running at http://localhost:${PORT}`);
      console.log(`📦 Mode: OFFLINE (Local MongoDB)`);
      console.log(`🗄️  DB: ${process.env.MONGO_URI}`);
      
      // Signal to Electron main process that we're ready
      if (process.send) {
        process.send({ type: 'BACKEND_READY', port: PORT });
      }
    });
  } catch (err) {
    console.error('❌ Failed to start local backend:', err.message);
    process.exit(1);
  }
}

startServer();
