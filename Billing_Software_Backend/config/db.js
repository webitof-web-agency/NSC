const mongoose = require('mongoose');
const offlineSyncPlugin = require('../middleware/offlineSync');

// Register offlineSyncPlugin globally for ALL models across the application
mongoose.plugin(offlineSyncPlugin);

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error('❌ MongoDB connection failed: MONGO_URI is not set');
    console.error('   Please check your environment variables');
    throw new Error('MONGO_URI is not set');
  }

  console.log('🔄 Attempting MongoDB connection...');
  console.log('   URI:', mongoUri.replace(/:[^:]*@/, ':****@'));

  try {

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 75000,
    });

    console.log('✅ MongoDB connected successfully');
    console.log('   Database:', mongoose.connection.name);
    return mongoose.connection;
  } catch (error) {

    console.error('❌ MongoDB connection failed:', error.message);
    console.error('   Error details:', error);
    throw error;
  }
};

mongoose.connection.on('connected', () => {
  console.log('🟢 Mongoose connected to MongoDB');
});

mongoose.connection.on('disconnected', () => {
  console.log('🔴 Mongoose disconnected from MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('⚠️ Mongoose connection error:', err.message);
});

mongoose.connection.on('reconnected', () => {
  console.log('🟡 Mongoose reconnected to MongoDB');
});

module.exports = connectDB;
