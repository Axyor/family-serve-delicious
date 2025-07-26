import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from 'dotenv';
import { initializeDatabase, disconnectDatabase, setDatabase } from './db';
import { groupResource, groupResourceHandler } from './resources/group.resource';
import { allGroupTools } from './tools/group.tools';

config();

export const server = new McpServer({
    name: "family-serve-delicious",
    version: "1.0.0"
});

export { setDatabase, groupResourceHandler };


const { name: resName, template, meta, handler } = groupResource();
server.registerResource(resName, template, meta, handler);
for (const tool of allGroupTools()) {
    server.registerTool(tool.name, tool.meta as any, tool.handler as any);
}
const start = async () => {
    try {

        if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be defined in environment variables');
        await initializeDatabase(process.env.MONGODB_URI);
        console.log('Successfully connected to MongoDB');

        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.log('MCP Server started successfully');
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
};

process.on('SIGINT', async () => {
    try {
        await disconnectDatabase();
        console.log('Disconnected from MongoDB');
    } catch (e) {
        console.error('Error during shutdown:', e);
    } finally {
        process.exit(0);
    }
});

if (process.env.NODE_ENV !== 'test') {
    start();
}

export { start };
