'use strict';

const mongoose = require('mongoose');
const { resolveReferences } = require('../utils/referenceResolver');

// Mapping of collectionNames from SyncJournal to Mongoose Models
// NOTE: Make sure the names here match what is in SyncRegistry!
const COLLECTION_MAP = {
  'customers': 'Customer',
  'invoices': 'Invoice',
  'quotations': 'Quotation',
  'credit-notes': 'CreditNote',
  'purchases': 'Purchase',
  'suppliers': 'Supplier',
  'supplier-payments': 'SupplierPayment',
  'users': 'User',
  'attendance': 'Attendance',
  'staff-salary': 'StaffSalary'
};

exports.applyEvent = async (req, res) => {
  const { event } = req.body;
  if (!event || !event.collectionName || !event.operation || !event.syncId) {
    return res.status(400).json({ success: false, message: 'Invalid event payload' });
  }

  let { collectionName, operation, syncId, payload, version } = event;
  const modelName = COLLECTION_MAP[collectionName];

  if (!modelName) {
    return res.status(400).json({ success: false, message: `Unsupported collection: ${collectionName}` });
  }

  const Model = mongoose.model(modelName);

  try {
    // 1. Resolve global syncIds to local ObjectIds for the payload
    if (payload && (operation === 'CREATE' || operation === 'UPDATE')) {
      payload = await resolveReferences(collectionName, payload, false);
    }
    // 1. Fetch current document if it exists
    const currentDoc = await Model.findOne({ syncId });

    // 2. Conflict resolution (Last-Writer-Wins using version)
    if (currentDoc && currentDoc.version > version) {
      console.log(`[Sync Apply] Skipped ${operation} on ${collectionName}/${syncId} - Local version (${currentDoc.version}) is newer than incoming (${version})`);
      return res.status(200).json({ success: true, status: 'skipped_older_version' });
    }

    // 3. Apply the operation
    if (operation === 'CREATE' || operation === 'UPDATE') {
      const updateData = { ...payload, version, syncId };
      delete updateData._id; // Ensure we don't overwrite MongoDB's internal ID
      delete updateData.__v;

      await Model.findOneAndUpdate(
        { syncId },
        { $set: updateData },
        { upsert: true, new: true, runValidators: false, $ignoreOutbox: true }
      );
      
      // Phase 17: Automatically scan incoming cloud data for files and queue Pull Requests
      const { extractFilePaths } = require('../utils/fileScanner');
      const FilePullRequest = mongoose.models.FilePullRequest || require('../models/FilePullRequest');
      const filePaths = extractFilePaths(updateData);
      
      for (const filePath of filePaths) {
         await FilePullRequest.findOneAndUpdate(
           { filePath }, 
           { $set: { filePath, status: 'PENDING', attempts: 0, error: null } },
           { upsert: true }
         );
      }
      
    } else if (operation === 'DELETE') {
      await Model.findOneAndUpdate(
        { syncId },
        { $set: { isDeleted: true, deletedAt: payload.deletedAt || new Date(), version } },
        { new: true, runValidators: false, $ignoreOutbox: true }
      );
    }

    res.status(200).json({ success: true, status: 'applied' });
  } catch (error) {
    console.error(`[Sync Apply Error] ${collectionName}/${syncId}:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};
