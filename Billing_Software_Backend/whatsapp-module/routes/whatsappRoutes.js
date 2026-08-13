const express = require('express');
const protect = require('../../middleware/authMiddleware');
const whatsappController = require('../controllers/whatsappController');
const whatsappWebhook = require('../webhooks/whatsappWebhook');

const router = express.Router();

router.get('/webhook', whatsappWebhook.verifyWebhook);
router.post('/webhook', whatsappWebhook.handleWebhook);

router.get('/settings', protect, whatsappController.getSettings);
router.post('/settings', protect, whatsappController.upsertSettings);
router.get('/templates', protect, whatsappController.listTemplates);
router.post('/templates', protect, whatsappController.createTemplate);
router.put('/templates/:id', protect, whatsappController.updateTemplate);
router.post('/send-manual', protect, whatsappController.sendManual);
router.get('/messages', protect, whatsappController.listMessages);
router.get('/messages/stats', protect, whatsappController.getMessageStats);
router.get('/messages/:id', protect, whatsappController.getMessageById);
router.post('/test-send', protect, whatsappController.testSend);

module.exports = router;
