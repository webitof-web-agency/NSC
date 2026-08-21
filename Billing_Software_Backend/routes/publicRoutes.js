const express = require('express');
const router = express.Router();
const legalSettingsController = require('@controllers/legalSettingsController');

const publicInvoiceController = require('../controllers/publicInvoiceController');
const publicQuotationController = require('../controllers/publicQuotationController');
const publicExchangeController = require('../controllers/publicExchangeController');
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

// Public Quotation Share
router.get('/quotations/:publicShareId', publicInvoiceRateLimit, publicQuotationController.getPublicQuotation);
router.get('/quotations/:publicShareId/pdf', publicInvoiceRateLimit, publicQuotationController.downloadPublicQuotationPdf);

// Public Exchange Share
router.get('/exchanges/:publicShareId', publicInvoiceRateLimit, publicExchangeController.getPublicExchange);
router.get('/exchanges/:publicShareId/pdf', publicInvoiceRateLimit, publicExchangeController.downloadPublicExchangePdf);

module.exports = router;
