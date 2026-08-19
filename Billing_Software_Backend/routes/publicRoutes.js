const express = require('express');
const router = express.Router();
const legalSettingsController = require('@controllers/legalSettingsController');

const publicInvoiceController = require('../controllers/publicInvoiceController');

router.get('/legal', legalSettingsController.getPublicLegalSettings);

// Public Invoice Share
router.get('/invoices/:publicShareId', publicInvoiceController.getPublicInvoice);
router.get('/invoices/:publicShareId/pdf', publicInvoiceController.downloadPublicInvoicePdf);
module.exports = router;
