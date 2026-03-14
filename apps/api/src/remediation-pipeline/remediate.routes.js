const express = require('express');
const router = express.Router();
const controller = require('./remediate.controller');

// ─── Smart Remediation ───────────────────────────────────────────
router.post('/smart-plan', controller.generateSmartPlan);   // Generate plan with AUTO_FIX / SUGGEST_FIX / INTENTIONAL_SKIP
router.post('/rollback', controller.rollback);               // Rollback a remediation using snapshot
router.get('/audit-log', controller.getAuditLog);            // Get remediation audit trail

// ─── Legacy / Direct Fix ────────────────────────────────────────
router.post('/plan', controller.generatePlan);               // Legacy plan generation
router.post('/approve', controller.approveFix);              // S3 fix (now with snapshot + audit)
router.post('/approve-ec2', controller.approveEC2Fix);       // EC2 fix (now with snapshot + audit)

module.exports = router;
