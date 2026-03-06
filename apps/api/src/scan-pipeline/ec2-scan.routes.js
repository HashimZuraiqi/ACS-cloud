const express = require('express');
const router = express.Router();
const controller = require('./ec2-scan.controller');

router.post('/', controller.startEC2Scan);
router.get('/', controller.getEC2Scans);
router.get('/:id', controller.getEC2ScanById);

module.exports = router;
