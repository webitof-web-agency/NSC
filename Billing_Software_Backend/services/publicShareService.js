const crypto = require('crypto');
const Invoice = require('../models/Invoice');

// Ensure token is URL-safe and high entropy
function generateSecureToken() {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Returns an existing enabled publicShareId, or lazily creates a new one.
 */
async function getOrCreatePublicShareId(invoice) {
  if (invoice.publicShareId && invoice.publicShareEnabled) {
    return invoice.publicShareId;
  }

  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      attempt++;
      const newToken = generateSecureToken();
      invoice.publicShareId = newToken;
      invoice.publicShareEnabled = true;
      if (!invoice.publicShareCreatedAt) {
        invoice.publicShareCreatedAt = new Date();
      }
      
      await invoice.save();
      return invoice.publicShareId;
    } catch (err) {
      if (err.code === 11000 && err.keyPattern && err.keyPattern.publicShareId) {
        // Collision happened, loop will retry
      } else {
        throw err;
      }
    }
  }

  throw new Error('Failed to generate a unique public share ID after multiple attempts');
}

/**
 * Force generates a new publicShareId and invalidates the old one.
 */
async function regeneratePublicShareId(invoice) {
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      attempt++;
      const newToken = generateSecureToken();
      invoice.publicShareId = newToken;
      invoice.publicShareEnabled = true;
      invoice.publicShareRegeneratedAt = new Date();
      if (!invoice.publicShareCreatedAt) {
        invoice.publicShareCreatedAt = new Date();
      }
      
      await invoice.save();
      return invoice.publicShareId;
    } catch (err) {
      if (err.code === 11000 && err.keyPattern && err.keyPattern.publicShareId) {
        // Collision
      } else {
        throw err;
      }
    }
  }

  throw new Error('Failed to regenerate a unique public share ID after multiple attempts');
}

async function disablePublicShare(invoice) {
  invoice.publicShareEnabled = false;
  await invoice.save();
  return invoice.publicShareId;
}

async function enablePublicShare(invoice) {
  if (!invoice.publicShareId) {
    return getOrCreatePublicShareId(invoice);
  }
  
  // Generating a new token when explicitly re-enabled as recommended
  return regeneratePublicShareId(invoice);
}

function buildPublicDocumentUrl(publicShareId, type = 'INVOICE') {
  const baseUrl = process.env.FRONTEND_URL || 'https://app.nareshsareecollection.com';
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  const typeMap = {
    INVOICE: 'invoice',
    QUOTATION: 'quotation',
    EXCHANGE: 'exchange'
  };

  const routeType = typeMap[type] || 'invoice';

  return `${cleanBaseUrl}/${routeType}/${publicShareId}`;
}

module.exports = {
  generatePublicShareId: generateSecureToken,
  getOrCreatePublicShareId,
  regeneratePublicShareId,
  disablePublicShare,
  enablePublicShare,
  buildPublicDocumentUrl
};
