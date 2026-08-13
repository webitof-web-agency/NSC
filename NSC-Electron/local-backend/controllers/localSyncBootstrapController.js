'use strict';

const mongoose = require('mongoose');
const { resolveReferences } = require('../utils/referenceResolver');

// Mapping of collection names used in the snapshot payload to Mongoose Models
const COLLECTION_MAP = {
  'customers': 'Customer',
  'invoices': 'Invoice',
  'quotations': 'Quotation',
  'suppliers': 'Supplier'
};

exports.applyBootstrap = async (req, res) => {
  const { snapshot } = req.body;
  if (!snapshot) {
    return res.status(400).json({ success: false, message: 'Snapshot payload required' });
  }

  try {
    for (const [collectionName, records] of Object.entries(snapshot)) {
      if (!Array.isArray(records) || records.length === 0) continue;

      const modelName = COLLECTION_MAP[collectionName];
      if (!modelName) {
        console.warn(`[Sync Bootstrap] Unknown collection: ${collectionName}`);
        continue;
      }

      const Model = mongoose.model(modelName);

      // Resolve global syncIds to local ObjectIds for all records
      for (let i = 0; i < records.length; i++) {
        records[i] = await resolveReferences(collectionName, records[i], false);
      }

      // We use bulkWrite for efficient bulk upserts based on syncId
      const bulkOps = records.map(record => {
        const updateData = { ...record };
        delete updateData._id; // Let local DB generate new internal _id
        delete updateData.__v;
        
        return {
          updateOne: {
            filter: { syncId: record.syncId },
            update: { $set: updateData },
            upsert: true
          }
        };
      });

      if (bulkOps.length > 0) {
        const result = await Model.bulkWrite(bulkOps, { ordered: false });
        console.log(`[Sync Bootstrap] Processed ${records.length} records for ${collectionName}. Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`);
      }
      
      // Phase 17: Automatically scan bootstrap snapshot for files and queue Pull Requests
      const { extractFilePaths } = require('../utils/fileScanner');
      const FilePullRequest = mongoose.models.FilePullRequest || require('../models/FilePullRequest');
      
      const filePaths = new Set();
      for (const record of records) {
         extractFilePaths(record, filePaths);
      }
      
      for (const filePath of filePaths) {
         await FilePullRequest.findOneAndUpdate(
           { filePath }, 
           { $set: { filePath, status: 'PENDING', attempts: 0, error: null } },
           { upsert: true }
         );
      }
    }

    res.status(200).json({ success: true, message: 'Bootstrap snapshot applied successfully' });

  } catch (error) {
    console.error('[Sync Bootstrap Error]:', error);
    res.status(500).json({ success: false, message: 'Failed to apply bootstrap snapshot', error: error.message });
  }
};
