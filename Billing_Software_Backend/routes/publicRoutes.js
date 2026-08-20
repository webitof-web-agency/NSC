const express = require('express');
const router = express.Router();
const legalSettingsController = require('@controllers/legalSettingsController');

const publicInvoiceController = require('../controllers/publicInvoiceController');
const { requireCustomerHistorySession } = require('../middleware/customerHistorySession');
const { publicInvoiceRateLimit } = require('../middleware/publicInvoiceRateLimit');

router.get('/legal', legalSettingsController.getPublicLegalSettings);

// Public Invoice Share
router.get(
  '/customer-history/invoices',
  publicInvoiceRateLimit,
  requireCustomerHistorySession,
  publicInvoiceController.listVerifiedCustomerInvoiceHistory,
);
router.get('/invoices/:publicShareId', publicInvoiceRateLimit, publicInvoiceController.getPublicInvoice);
router.get('/invoices/:publicShareId/pdf', publicInvoiceRateLimit, publicInvoiceController.downloadPublicInvoicePdf);
module.exports = router;
