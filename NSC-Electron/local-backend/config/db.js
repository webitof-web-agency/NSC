// local-backend/config/db.js
// Connects to local MongoDB instance (managed by MongoDB Compass)

'use strict';

const mongoose = require('mongoose');

const connectDB = async () => {
  const candidateUris = [
    process.env.MONGO_URI,
    'mongodb://127.0.0.1:27017/nsc_local',
    'mongodb://127.0.0.1:27018/nsc_local?directConnection=true',
    'mongodb://localhost:27017/nsc_local',
    'mongodb://localhost:27018/nsc_local?directConnection=true',
  ].filter(Boolean);

  // Deduplicate URIs
  const uniqueUris = Array.from(new Set(candidateUris));
  let connected = false;
  let lastError = null;

  for (const uri of uniqueUris) {
    try {
      console.log(`🔄 Connecting to local MongoDB at: ${uri}`);
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 3000, // Fast 3s timeout per candidate
        socketTimeoutMS: 30000,
        maxPoolSize: 10,
      });
      console.log(`✅ Local MongoDB connected successfully to database: ${mongoose.connection.name} (${uri})`);
      connected = true;

      // Initialize Replica Set if needed (for Transactions support on port 27018)
      if (uri.includes('27018')) {
        try {
          const adminDb = mongoose.connection.db.admin();
          await adminDb.command({ replSetGetStatus: 1 });
        } catch (rsError) {
          if (rsError.codeName === 'NotYetInitialized' || rsError.code === 94) {
            console.log('⏳ Initializing MongoDB replica set for transactions (first run)...');
            try {
              const adminDb = mongoose.connection.db.admin();
              await adminDb.command({
                replSetInitiate: {
                  _id: 'rs0',
                  members: [{ _id: 0, host: '127.0.0.1:27018' }]
                }
              });
              console.log('✅ Replica set successfully initialized.');
            } catch (initErr) {
              console.error('❌ Failed to initialize replica set:', initErr.message);
            }
          }
        }
      }

      break;
    } catch (err) {
      console.warn(`⚠️ Could not connect to ${uri}: ${err.message}`);
      lastError = err;
    }
  }

  if (!connected) {
    console.error('❌ All local MongoDB connection attempts failed.');
    console.error('🔧 Ensure MongoDB is running locally on port 27017 or 27018.');
    throw lastError || new Error('Local MongoDB connection failed');
  }
};

mongoose.connection.on('connected', () => {
  console.log('🟢 Mongoose: connected to local MongoDB');
});

mongoose.connection.on('disconnected', () => {
  console.log('🔴 Mongoose: disconnected from local MongoDB');
  // Auto-reconnect
  setTimeout(() => connectDB().catch(console.error), 5000);
});

mongoose.connection.on('error', (err) => {
  console.error('⚠️  Mongoose error:', err.message);
});

module.exports = connectDB;
