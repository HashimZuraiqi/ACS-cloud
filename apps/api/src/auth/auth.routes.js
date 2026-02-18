const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_for_dev";

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Failed to authenticate token" });
        req.user = decoded;
        next();
    });
};

router.post('/signup', controller.signup);
router.post('/login', controller.login);
router.get('/me', verifyToken, controller.getMe);

module.exports = router;
