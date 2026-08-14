// electron/mongodbManager.js
// Manages the lifecycle of a local MongoDB instance bundled with the app.
// In production, uses the bundled mongod.exe from extraResources.
// Falls back to system PATH mongod if bundled binary is not found.

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

class MongoDBManager {
  constructor(app) {
    this.app = app;
    this.port = 27018;
    this.process = null;
    this.dataDir = path.join(this.app.getPath('userData'), 'mongodb', 'data');
    this._isDev = process.argv.includes('--dev');
  }

  /**
   * Resolve the mongod executable path.
   * Priority:
   *   1. Bundled binary in extraResources (production)
   *   2. Bundled binary relative to source (development)
   *   3. System PATH fallback ('mongod')
   */
  _resolveMongodPath() {
    const platformDir = process.platform === 'win32' ? 'win-x64' : 'linux-x64';
    const binaryName = process.platform === 'win32' ? 'mongod.exe' : 'mongod';

    // Production: extraResources/mongodb-bin/<platform>/mongod
    const prodPath = path.join(process.resourcesPath || '', 'mongodb-bin', platformDir, binaryName);
    if (!this._isDev && fs.existsSync(prodPath)) {
      console.log('📦 Using bundled mongod from:', prodPath);
      return prodPath;
    }

    // Development: NSC-Electron/mongodb-bin/<platform>/mongod
    const devPath = path.join(__dirname, '..', 'mongodb-bin', platformDir, binaryName);
    if (fs.existsSync(devPath)) {
      console.log('📦 Using local mongod binary from:', devPath);
      return devPath;
    }

    // Fallback: system PATH
    console.log('⚠️  No bundled mongod found — falling back to system PATH');
    return 'mongod';
  }

  // Check if port 27018 is already in use
  isPortInUse() {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      server.once('listening', () => {
        server.close();
        resolve(false);
      });
      server.listen(this.port, '127.0.0.1');
    });
  }

  async start() {
    console.log('⏳ Checking if managed MongoDB is already running...');
    const inUse = await this.isPortInUse();
    
    if (inUse) {
      console.log('✅ MongoDB is already running on port ' + this.port);
      return;
    }

    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      console.log('📁 Creating MongoDB data directory at:', this.dataDir);
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const mongodPath = this._resolveMongodPath();
    console.log('🚀 Spawning local MongoDB on port ' + this.port);
    console.log('   Binary:', mongodPath);
    console.log('   Data dir:', this.dataDir);
    
    return new Promise((resolve, reject) => {
      this.process = spawn(mongodPath, [
        '--port', String(this.port),
        '--dbpath', this.dataDir,
        '--bind_ip', '127.0.0.1',
        '--replSet', 'rs0'
      ]);

      this.process.stdout.on('data', (data) => {
        const out = data.toString();
        if (out.includes('Waiting for connections')) {
          console.log('✅ Managed MongoDB is ready for connections.');
          resolve();
        }
      });

      this.process.stderr.on('data', (data) => {
        // Log sparingly
        if (data.toString().includes('error')) {
          console.error(`[MongoDB] ${data.toString().trim()}`);
        }
      });

      this.process.on('error', (err) => {
        console.error('❌ Failed to spawn MongoDB:', err.message);
        if (err.code === 'ENOENT') {
          console.error('   mongod binary not found. Please ensure MongoDB Community Server is installed');
          console.error(`   or place the binary in the mongodb-bin/${process.platform === 'win32' ? 'win-x64' : 'linux-x64'}/ directory.`);
        }
        reject(err);
      });

      this.process.on('exit', (code) => {
        console.log(`⚠️  MongoDB process exited with code ${code}`);
        this.process = null;
      });

      // Fallback timeout
      setTimeout(() => {
        if (this.process) {
          console.log('⏱️ MongoDB spawn timeout reached, assuming it is running.');
          resolve();
        }
      }, 10000);
    });
  }

  stop() {
    if (this.process) {
      console.log('🛑 Stopping managed MongoDB...');
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}

module.exports = MongoDBManager;
