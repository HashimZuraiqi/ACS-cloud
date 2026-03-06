const express = require('express');
const router = express.Router();
const controller = require('./iam-scan.controller');

router.post('/', controller.startIAMScan);
router.get('/', controller.getIAMScans);
router.get('/:id', controller.getIAMScanById);

module.exports = router;
