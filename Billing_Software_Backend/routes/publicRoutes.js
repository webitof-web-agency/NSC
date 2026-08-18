const express = require('express');
const router = express.Router();
const legalSettingsController = require('@controllers/legalSettingsController');

router.get('/legal', legalSettingsController.getPublicLegalSettings);

module.exports = router;
