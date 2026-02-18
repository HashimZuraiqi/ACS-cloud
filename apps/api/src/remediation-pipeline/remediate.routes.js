const express = require('express');
const router = express.Router();
const controller = require('./remediate.controller');

router.post('/plan', controller.generatePlan);
router.post('/approve', controller.approveFix);

module.exports = router;
