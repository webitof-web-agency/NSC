// local-backend/config/db.js
// Connects to local MongoDB instance (managed by MongoDB Compass)

'use strict';

const mongoose = require('mongoose');

const connectDB = async () => {
  // Always use the dedicated port for the managed local database.
  // directConnection=true is required to connect to an uninitialized replica set
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/nsc_local?directConnection=true';

  console.log('🔄 Connecting to managed local MongoDB...');
  console.log(`   URI: ${mongoUri}`);

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000, // 15s timeout for local connection
      socketTimeoutMS: 30000,
      maxPoolSize: 10,
    });
    console.log('✅ Managed Local MongoDB connected:', mongoose.connection.name);

    // Initialize Replica Set if needed (for Transactions support)
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
      } else {
        console.warn('⚠️ Could not check replica set status:', rsError.message);
      }
    }

  } catch (error) {
    console.error('❌ Managed Local MongoDB connection failed:', error.message);
    console.error('');
    console.error('🔧 TROUBLESHOOTING:');
    console.error('   1. The Electron app should automatically start MongoDB on port 27018.');
    console.error('   2. Check if the mongod process was blocked by antivirus or firewall.');
    console.error('   3. Ensure you have MongoDB Community Server installed (mongod in PATH) for the app to spawn it.');
    throw error;
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
