const express = require('express');
const router = express.Router();
const phonepeController = require('../controllers/phonepeController');
const authenticateToken = require('../middleware/authMiddleware'); // Adjusted import

// Create QR Code Order
router.post('/create-qr-order', authenticateToken, phonepeController.createPhonePeQROrder);

// Verify Payment Status (Polling)
router.post('/verify-payment', authenticateToken, phonepeController.verifyPhonePePayment);

// Webhook (No Auth - PhonePe calls this)
router.post('/webhook', phonepeController.handlePhonePeWebhook);

module.exports = router;
