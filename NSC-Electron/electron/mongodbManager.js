// electron/mongodbManager.js
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
    this.dataDir = path.join(this.app.getPath('userData'), 'mongodb_data');
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

    console.log('🚀 Spawning local MongoDB on port ' + this.port);
    
    return new Promise((resolve, reject) => {
      // In production, you would point this to a bundled mongod binary.
      // For now, it assumes MongoDB Community Server is in the system PATH.
      this.process = spawn('mongod', [
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
        console.error('❌ Failed to spawn MongoDB (is it in PATH?):', err);
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
      }, 5000);
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
