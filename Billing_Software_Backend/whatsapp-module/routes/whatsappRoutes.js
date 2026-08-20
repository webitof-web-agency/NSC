const express = require('express');
const protect = require('../../middleware/authMiddleware');
const whatsappController = require('../controllers/whatsappController');
const metaTemplateController = require('../controllers/whatsappMetaTemplateController');
const assignmentController = require('../controllers/whatsappTemplateAssignmentController');
const upload = require('../../middleware/upload');

const router = express.Router();

// Meta Templates
router.get('/meta-templates', protect, metaTemplateController.getMetaTemplates);
router.post('/meta-templates', protect, metaTemplateController.createTemplate);
router.post('/meta-templates/sync', protect, metaTemplateController.syncMetaTemplates);

// Template Assignments
router.get('/template-assignments', protect, assignmentController.getAssignments);
router.get('/template-assignments/:messageType', protect, assignmentController.getAssignmentByType);
router.put('/template-assignments/:messageType', protect, upload.single('headerImage'), assignmentController.upsertAssignment);

// Campaigns
const campaignController = require('../controllers/whatsappCampaignController');
router.get('/campaigns/eligible-customers', protect, campaignController.getEligibleCustomers);
router.post('/campaigns', protect, campaignController.createCampaign);
router.get('/campaigns', protect, campaignController.getCampaigns);
router.get('/campaigns/:id', protect, campaignController.getCampaignById);

router.get('/settings', protect, whatsappController.getSettings);
router.post('/settings', protect, whatsappController.upsertSettings);

// Legacy Local Templates (Keep temporarily for migration fallback if needed, or remove if unused)
router.get('/templates', protect, whatsappController.listTemplates);
router.post('/templates', protect, whatsappController.createTemplate);
router.put('/templates/:id', protect, whatsappController.updateTemplate);

router.post('/send-manual', protect, whatsappController.sendManual);
router.get('/messages', protect, whatsappController.listMessages);
router.get('/messages/stats', protect, whatsappController.getMessageStats);
router.get('/messages/:id', protect, whatsappController.getMessageById);
router.post('/test-send', protect, whatsappController.testSend);

module.exports = router;
