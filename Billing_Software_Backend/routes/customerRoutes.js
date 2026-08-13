const express = require('express');
const router = express.Router();
const customerProtect = require('../middleware/customerAuthMiddleware');
const customerPortalController = require('../controllers/customerPortalController');

router.get('/settings', customerProtect, customerPortalController.getCustomerPortalSettings);
router.get('/me', customerProtect, customerPortalController.getCustomerMe);
router.put('/profile', customerProtect, customerPortalController.updateCustomerProfile);
router.get('/dashboard', customerProtect, customerPortalController.getCustomerDashboard);
router.get('/invoices', customerProtect, customerPortalController.listCustomerInvoices);
router.get('/invoices/:id', customerProtect, customerPortalController.getCustomerInvoiceById);

module.exports = router;
