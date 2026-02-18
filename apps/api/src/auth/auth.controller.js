const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { docClient } = require('../config/db');
const { PutCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "CloudGuard_Users"; // Ensure this table exists in DynamoDB
const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_for_dev";

exports.signup = async (req, res) => {
    const { email, password, fullName, company } = req.body;

    if (!email || !password || !fullName) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // 1. Check if user exists
        const checkCommand = new GetCommand({
            TableName: TABLE_NAME,
            Key: { email }
        });
        const existing = await docClient.send(checkCommand);
        if (existing.Item) {
            return res.status(409).json({ error: "User already exists" });
        }

        // 2. Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Create User
        const newUser = {
            email,
            password: hashedPassword,
            fullName,
            company: company || "Independent",
            role: "admin", // Default role for now
            createdAt: new Date().toISOString()
        };

        const putCommand = new PutCommand({
            TableName: TABLE_NAME,
            Item: newUser
        });
        await docClient.send(putCommand);

        // 4. Generate Token
        const token = jwt.sign({ email, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
            message: "User created successfully",
            token,
            user: {
                email: newUser.email,
                fullName: newUser.fullName,
                company: newUser.company
            }
        });

    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: { email }
        });
        const response = await docClient.send(command);
        const user = response.Item;

        if (!user) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        res.json({
            message: "Login successful",
            token,
            user: {
                email: user.email,
                fullName: user.fullName,
                company: user.company
            }
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getMe = async (req, res) => {
    // Middleware should attach user email to req.user
    const email = req.user?.email;
    if (!email) return res.status(401).json({ error: "Unauthorized" });

    try {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: { email }
        });
        const response = await docClient.send(command);
        const user = response.Item;

        if (!user) return res.status(404).json({ error: "User not found" });

        // Don't return password
        const { password, ...safeUser } = user;
        res.json(safeUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
