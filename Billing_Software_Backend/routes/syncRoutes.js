const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const { protect } = require('../middleware/authMiddleware');

const multer = require('multer');
const upload = multer({ dest: 'uploads/temp_sync/' });

router.get('/pull', protect, syncController.pullSyncEvents);
router.get('/bootstrap', protect, syncController.getBootstrapSnapshot);
router.post('/push', protect, syncController.pushSyncEvents);
router.post('/allocate-numbers', protect, syncController.allocateNumbers);

router.get('/conflicts', protect, syncController.getConflicts);
router.post('/resolve-conflict', protect, syncController.resolveConflict);

router.post('/file-push', protect, upload.single('file'), syncController.filePush);
router.get('/file-pull', protect, syncController.filePull);

module.exports = router;
