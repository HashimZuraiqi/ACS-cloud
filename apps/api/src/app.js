const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const scanRoutes = require('./scan-pipeline/scan.routes');
const ec2ScanRoutes = require('./scan-pipeline/ec2-scan.routes');
const iamScanRoutes = require('./scan-pipeline/iam-scan.routes');
const costScanRoutes = require('./scan-pipeline/cost-scan.routes');
const remediateRoutes = require('./remediation-pipeline/remediate.routes');
const reportRoutes = require('./reporting-pipeline/report.routes');
const authRoutes = require('./auth/auth.routes');
const { verifyToken } = require('./middleware/auth.middleware');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/scan', verifyToken, scanRoutes);
app.use('/api/ec2-scan', verifyToken, ec2ScanRoutes);
app.use('/api/iam-scan', verifyToken, iamScanRoutes);
app.use('/api/cost-scan', verifyToken, costScanRoutes);
app.use('/api/remediate', verifyToken, remediateRoutes);
app.use('/api/reports', verifyToken, reportRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'CloudGuard API' });
});

module.exports = app;
