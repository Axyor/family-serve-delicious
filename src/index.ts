import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from 'dotenv';
import { initializeDatabase, disconnectDatabase, setDatabase } from './db';
import { groupResource, groupResourceHandler } from './resources/group.resource';
import { allGroupTools } from './tools/group.tools';
import { allFamilyPrompts } from './prompts/family.prompts';
import { OutputValidator } from './security/output-validation';

if (process.env.NODE_ENV !== 'production') {
    config();
}

export * from './interfaces';

export const server = new McpServer({
    name: "family-serve-delicious",
    version: "1.0.0"
});

export { setDatabase, groupResourceHandler };


const { name: resName, template, meta, handler } = groupResource();
server.registerResource(resName, template, meta, handler);

const wrapHandlerWithValidation = (handler: (...args: any[]) => Promise<any>, toolName: string) => {
    return async (args: any) => {
        const result = await handler(args);
        const validation = OutputValidator.validateOutput(result, { toolName });

        if (!validation.safe) {
            console.warn(`Output validation warnings for ${toolName}:`, validation.warnings);
            const strictness = OutputValidator.getStrictness();

            if (strictness === 'mask') {
                return OutputValidator.maskPII(result);
            }

            if (strictness === 'block') {
                throw new Error(`Output blocked for ${toolName}: ${validation.warnings.join('; ')}`);
            }
        }

        return result;
    };
};

for (const tool of allGroupTools()) {
    const wrappedHandler = wrapHandlerWithValidation(tool.handler, tool.name);
    server.registerTool(tool.name, tool.meta as any, wrappedHandler as any);
}

for (const prompt of allFamilyPrompts()) {
    server.registerPrompt(prompt.name, prompt.meta, prompt.handler);
}
const start = async () => {
    try {

        if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be defined in environment variables');
        await initializeDatabase(process.env.MONGODB_URI);
        console.error('Successfully connected to MongoDB');

        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error('MCP Server started successfully');
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
