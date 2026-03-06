const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.post('/signup', controller.signup);
router.post('/login', controller.login);
router.get('/me', verifyToken, controller.getMe);
router.put('/aws-credentials', verifyToken, controller.updateAwsCredentials);

module.exports = router;
