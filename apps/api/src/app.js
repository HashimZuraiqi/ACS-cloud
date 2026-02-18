const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const scanRoutes = require('./scan-pipeline/scan.routes');
const remediateRoutes = require('./remediation-pipeline/remediate.routes');
const authRoutes = require('./auth/auth.routes');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/remediate', remediateRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'CloudGuard API' });
});

module.exports = app;
