require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');
const { ensureTables } = require('./config/init-db');

const PORT = process.env.PORT || 4000;

// Connect to DynamoDB and ensure tables exist
const startServer = async () => {
    await connectDB();
    await ensureTables();

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV}`);
    });
};

startServer();
