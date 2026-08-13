const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let mongodProcess = null;

async function startLocalMongoDB() {
  return new Promise((resolve, reject) => {
    // 1. Setup data directory in user's AppData folder
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'mongodb_data');
    
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }

    console.log(`[MongoDB] Starting mongod with dbpath: ${dbPath}`);

    // 2. Spawn mongod as a single-node replica set on port 27018
    // We MUST use a replica set to support Mongoose transactions
    mongodProcess = spawn('mongod', [
      '--dbpath', dbPath,
      '--port', '27018',
      '--bind_ip', '127.0.0.1',
      '--replSet', 'rs0'
    ]);

    let isReady = false;

    mongodProcess.stdout.on('data', (data) => {
      const output = data.toString();
      // console.log(`[mongod] ${output.trim()}`);
      
      // Wait for the server to be ready for connections
      if (!isReady && output.includes('Waiting for connections')) {
        isReady = true;
        console.log('[MongoDB] mongod process is running and waiting for connections.');
        
        // 3. Initialize Replica Set
        initializeReplicaSet().then(resolve).catch(reject);
      }
    });

    mongodProcess.stderr.on('data', (data) => {
      console.error(`[mongod ERR] ${data.toString().trim()}`);
    });

    mongodProcess.on('error', (err) => {
      console.error('[MongoDB] Failed to start mongod:', err.message);
      reject(err);
    });

    mongodProcess.on('exit', (code) => {
      console.log(`[MongoDB] mongod exited with code ${code}`);
    });

    // Timeout
    setTimeout(() => {
      if (!isReady) {
        console.warn('[MongoDB] Startup timeout reached, proceeding anyway...');
        resolve();
      }
    }, 10000);
  });
}

async function initializeReplicaSet() {
  console.log('[MongoDB] Ensuring replica set is initialized...');
  return new Promise((resolve, reject) => {
    // We use the mongo shell (mongosh) to run rs.initiate()
    // It will safely fail if already initialized
    const initScript = `
      try {
        rs.initiate();
      } catch (e) {
        print("Replica set already initialized or error: " + e.message);
      }
    `;
    
    const mongoshProcess = spawn('mongosh', [
      'mongodb://127.0.0.1:27018',
      '--eval', initScript
    ]);

    mongoshProcess.on('exit', (code) => {
      console.log(`[MongoDB] Replica set initialization check finished (code ${code}).`);
      resolve();
    });

    mongoshProcess.on('error', (err) => {
      console.warn('[MongoDB] Failed to run mongosh. Ensure it is installed in PATH.', err.message);
      // We resolve anyway, as it might already be initialized from a previous run
      resolve();
    });
  });
}

function stopLocalMongoDB() {
  if (mongodProcess) {
    console.log('[MongoDB] Stopping mongod process...');
    mongodProcess.kill('SIGTERM');
    mongodProcess = null;
  }
}

module.exports = {
  startLocalMongoDB,
  stopLocalMongoDB
};
