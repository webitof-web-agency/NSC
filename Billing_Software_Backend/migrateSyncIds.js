// migrateSyncIds.js
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

async function runMigration() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is missing in .env');
    }

    console.log('Connecting to Atlas...');
    await mongoose.connect(mongoUri);
    console.log('Connected.');

    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const collectionInfo of collections) {
      const colName = collectionInfo.name;
      // Skip system collections and sessions
      if (colName.startsWith('system.') || colName === 'sessions') continue;

      console.log(`\nProcessing collection: ${colName}`);
      const collection = mongoose.connection.db.collection(colName);

      // Find documents missing syncId
      const cursor = collection.find({ syncId: { $exists: false } });
      const count = await collection.countDocuments({ syncId: { $exists: false } });
      
      if (count === 0) {
        console.log(`  No documents to migrate in ${colName}`);
        continue;
      }

      console.log(`  Found ${count} documents missing syncId. Migrating...`);

      let bulkOps = [];
      let processed = 0;

      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { 
              $set: { 
                syncId: uuidv4(),
                version: 1,
                deletedAt: null 
              } 
            }
          }
        });

        // Execute in batches of 500
        if (bulkOps.length >= 500) {
          await collection.bulkWrite(bulkOps);
          processed += bulkOps.length;
          console.log(`  ... migrated ${processed}/${count}`);
          bulkOps = [];
        }
      }

      // Execute remaining
      if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps);
        processed += bulkOps.length;
        console.log(`  ... migrated ${processed}/${count}`);
      }

      // Create unique sparse index for syncId
      // It must be sparse because some collections might not be fully migrated or might not use the plugin
      try {
        await collection.createIndex({ syncId: 1 }, { unique: true, sparse: true });
        console.log(`  Created unique sparse index on syncId for ${colName}`);
      } catch (idxErr) {
        console.error(`  Warning: Could not create index on ${colName}:`, idxErr.message);
      }
    }

    console.log('\n✅ Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
