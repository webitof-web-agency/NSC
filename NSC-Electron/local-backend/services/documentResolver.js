/**
 * Centralized logic to resolve the logical document type for a given invoice record.
 * 
 * @param {Object} invoice - The invoice document
 * @returns {string} - "exchange" or "invoice"
 */
function resolveDocumentType(invoice) {
  if (!invoice) return 'invoice';
  
  if (invoice.isExchange === true || invoice.status === 'EXCHANGE') {
    return 'exchange';
  }
  
  return 'invoice';
}

module.exports = {
  resolveDocumentType,
};
