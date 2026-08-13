'use strict';

const mongoose = require('mongoose');

/**
 * Dynamically resolves references in a document payload based on its Mongoose schema.
 * 
 * @param {string} collectionName - The name of the collection (e.g., 'customers')
 * @param {Object} payload - The document payload (e.g., invoice.toObject())
 * @param {boolean} toCloud - If true, translates local ObjectId -> global syncId. If false, translates global syncId -> local ObjectId.
 * @returns {Promise<Object>} The resolved payload.
 */
exports.resolveReferences = async (collectionName, payload, toCloud = true) => {
  if (!payload) return payload;
  
  // Find the model corresponding to the collection name
  const modelName = getModelNameFromCollection(collectionName);
  if (!modelName) return payload;

  const Model = mongoose.models[modelName];
  if (!Model) return payload; // Model not loaded yet

  // Extract reference paths from the schema
  const refPaths = getReferencePaths(Model.schema);
  
  // Clone the payload so we don't mutate the original directly
  const resolvedPayload = JSON.parse(JSON.stringify(payload));

  for (const refPath of refPaths) {
    const { path, refModelName, isArray, isDocumentArray } = refPath;
    const RefModel = mongoose.models[refModelName];
    if (!RefModel) continue;

    if (isDocumentArray) {
      // E.g., items is an array of objects, and each object has 'product_id'
      const [arrayPath, nestedPath] = path.split('.$.');
      const arrayData = getNestedValue(resolvedPayload, arrayPath);
      
      if (Array.isArray(arrayData)) {
        for (const item of arrayData) {
          const val = getNestedValue(item, nestedPath);
          if (val) {
            const resolvedVal = await translateId(RefModel, val, toCloud);
            if (resolvedVal) setNestedValue(item, nestedPath, resolvedVal);
          }
        }
      }
    } else if (isArray) {
      // Array of ObjectIds
      const arrayData = getNestedValue(resolvedPayload, path);
      if (Array.isArray(arrayData)) {
        const resolvedArray = [];
        for (const val of arrayData) {
          const resolvedVal = await translateId(RefModel, val, toCloud);
          if (resolvedVal) resolvedArray.push(resolvedVal);
        }
        setNestedValue(resolvedPayload, path, resolvedArray);
      }
    } else {
      // Single ObjectId
      const val = getNestedValue(resolvedPayload, path);
      if (val) {
        const resolvedVal = await translateId(RefModel, val, toCloud);
        if (resolvedVal) setNestedValue(resolvedPayload, path, resolvedVal);
      }
    }
  }

  return resolvedPayload;
};

/**
 * Translates between local ObjectId and global syncId
 */
async function translateId(RefModel, idValue, toCloud) {
  if (!idValue) return null;
  
  try {
    if (toCloud) {
      // We have a local ObjectId, we want a global syncId
      if (!mongoose.Types.ObjectId.isValid(idValue)) return idValue; // already a string/syncId?
      const doc = await RefModel.findById(idValue).select('syncId').lean();
      return doc ? doc.syncId : idValue;
    } else {
      // We have a global syncId, we want a local ObjectId
      const doc = await RefModel.findOne({ syncId: idValue }).select('_id').lean();
      return doc ? doc._id.toString() : idValue;
    }
  } catch (err) {
    console.error(`[ReferenceResolver] Error translating ID ${idValue}:`, err.message);
    return idValue; // Fallback to original
  }
}

/**
 * Introspect schema to find all reference paths
 */
function getReferencePaths(schema, basePath = '') {
  let refs = [];
  
  for (const [path, schemaType] of Object.entries(schema.paths)) {
    const fullPath = basePath ? `${basePath}.${path}` : path;

    if (schemaType.instance === 'ObjectID' && schemaType.options && schemaType.options.ref) {
      refs.push({ path: fullPath, refModelName: schemaType.options.ref, isArray: false });
    } 
    else if (schemaType.instance === 'Array' && schemaType.caster && schemaType.caster.instance === 'ObjectID' && schemaType.caster.options.ref) {
      refs.push({ path: fullPath, refModelName: schemaType.caster.options.ref, isArray: true });
    } 
    else if (schemaType.instance === 'Array' && schemaType.schema) {
      // DocumentArray (subdocuments)
      const subRefs = getReferencePaths(schemaType.schema, `${fullPath}.\$`);
      refs = refs.concat(subRefs);
    }
  }
  return refs;
}

// Map collection names to Model names
function getModelNameFromCollection(collectionName) {
  const map = {
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
  return map[collectionName];
}

// Utility to get nested value (e.g. 'address.city')
function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

// Utility to set nested value
function setNestedValue(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const target = parts.reduce((acc, part) => {
    if (!acc[part]) acc[part] = {};
    return acc[part];
  }, obj);
  if (target) target[last] = value;
}
