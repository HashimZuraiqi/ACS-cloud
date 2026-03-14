const express = require('express');
const router = express.Router();
const controller = require('./report.controller');

router.get('/download', controller.downloadReport);                     // Download full PDF
router.get('/download-resource', controller.downloadResourceReport);    // Download per-resource PDF
router.get('/data', controller.getReportData);
router.get('/timeline', controller.getTimeline);
router.get('/summary', controller.getSummary);

module.exports = router;
