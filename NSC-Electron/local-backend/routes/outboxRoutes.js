const express = require('express');
const router = express.Router();
const outboxController = require('../controllers/outboxController');

router.get('/pending', outboxController.getPendingEvents);
router.post('/mark-synced', outboxController.markEventsSynced);

module.exports = router;
