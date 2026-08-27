// local-backend/config/db.js
// Connects to local MongoDB instance (managed by MongoDBManager or local Compass)

'use strict';

const mongoose = require('mongoose');
const offlineSyncPlugin = require('../middleware/offlineSync');

// Register offlineSyncPlugin globally for ALL models across the application
mongoose.plugin(offlineSyncPlugin);

const connectDB = async () => {
  const candidateUris = [
    process.env.MONGO_URI,
    'mongodb://127.0.0.1:27017/nsc_local',
    'mongodb://localhost:27017/nsc_local',
    'mongodb://127.0.0.1:27018/nsc_local',
    'mongodb://localhost:27018/nsc_local',
  ].filter(Boolean);

  // Deduplicate URIs
  const uniqueUris = Array.from(new Set(candidateUris));
  let connected = false;
  let lastError = null;

  for (const uri of uniqueUris) {
    try {
      console.log(`🔄 Connecting to local MongoDB at: ${uri}`);
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        maxPoolSize: 10,
      });
      console.log(`✅ Local MongoDB connected successfully to database: ${mongoose.connection.name} (${uri})`);
      connected = true;
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
  setTimeout(() => connectDB().catch(console.error), 5000);
});

mongoose.connection.on('error', (err) => {
  console.error('⚠️  Mongoose error:', err.message);
});

module.exports = connectDB;
