import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeDatabase } from "./database.js";
import { server } from "./server.js";
import { registerGroupResource } from "./resources/group.js";
import { registerGroupTools } from "./tools/group.js";

const start = async () => {
    try {
        const db = await initializeDatabase();
        console.log('Successfully connected to MongoDB');

        registerGroupResource(db);
        registerGroupTools(db);

        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.log('MCP Server started successfully');
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
};

start();