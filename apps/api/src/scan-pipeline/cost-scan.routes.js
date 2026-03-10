const express = require('express');
const { startCostScan, getCostScans, getCostScanById } = require('./cost-scan.controller');

const router = express.Router();

router.post('/', startCostScan);
router.get('/', getCostScans);
router.get('/:id', getCostScanById);

module.exports = router;
