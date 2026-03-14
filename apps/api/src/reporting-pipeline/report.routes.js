const express = require('express');
const router = express.Router();
const controller = require('./report.controller');

router.get('/download', controller.downloadReport);   // Download PDF report
router.get('/data', controller.getReportData);         // Full report data as JSON
router.get('/timeline', controller.getTimeline);       // Security timeline only
router.get('/summary', controller.getSummary);         // Executive summary for dashboard

module.exports = router;
