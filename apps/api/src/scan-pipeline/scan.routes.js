const express = require('express');
const router = express.Router();
const controller = require('./scan.controller');

router.post('/', controller.startScan);
router.get('/', controller.getScans);
router.get('/:id', controller.getScanById);

module.exports = router;
