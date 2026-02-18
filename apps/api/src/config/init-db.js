const { CreateTableCommand, ListTablesCommand } = require("@aws-sdk/client-dynamodb");
const { client } = require("./db");

const ensureTables = async () => {
    console.log("Checking DynamoDB tables...");
    try {
        const listCommand = new ListTablesCommand({});
        const result = await client.send(listCommand);
        const tables = result.TableNames || [];

        const requiredTables = [
            {
                TableName: "CloudGuard_Users",
                KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
                AttributeDefinitions: [{ AttributeName: "email", AttributeType: "S" }],
                ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
            },
            {
                TableName: "CloudGuard_Scans",
                KeySchema: [{ AttributeName: "scan_id", KeyType: "HASH" }],
                AttributeDefinitions: [{ AttributeName: "scan_id", AttributeType: "S" }],
                ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
            }
        ];

        for (const tableConfig of requiredTables) {
            if (!tables.includes(tableConfig.TableName)) {
                console.log(`Creating table: ${tableConfig.TableName}...`);
                const createCommand = new CreateTableCommand(tableConfig);
                await client.send(createCommand);
                console.log(`Table ${tableConfig.TableName} created successfully.`);
            } else {
                console.log(`Table ${tableConfig.TableName} already exists.`);
            }
        }
    } catch (error) {
        console.error("Error ensuring tables:", error);
    }
};

module.exports = { ensureTables };
