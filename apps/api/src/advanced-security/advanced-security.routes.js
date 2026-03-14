const express = require('express');
const router = express.Router();
const controller = require('./advanced-security.controller');

router.get('/insights', controller.getSecurityInsights);       // Full analysis
router.get('/attack-paths', controller.getAttackPaths);         // Attack paths only
router.get('/mitre-coverage', controller.getMitreCoverage);            // MITRE ATT&CK only
router.get('/anomalies', controller.getAnomalies);              // Anomalies only
router.get('/toxic-combos', controller.getToxicCombos);
router.get('/secrets', controller.getSecrets);
router.get('/threat-analysis', controller.getThreatAnalysis);

module.exports = router;
