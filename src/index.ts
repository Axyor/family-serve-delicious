import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError, ErrorCode, CompleteRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import path from 'path';
import { initializeDatabase, disconnectDatabase, setDatabase, getDatabase } from './db';
import { ToolResult } from './interfaces';
import { groupResource, groupResourceHandler, groupResourceList } from './resources/group.resource';
import { allGroupTools } from './tools/group.tools';
import { allFamilyPrompts } from './prompts/family.prompts';
import { OutputValidator } from './security/output-validation';
import { initializePromptCache } from './prompts/prompt-cache';

// NOTE: We cast McpServer to access the private _completionHandlerInitialized flag below.
// This is needed because we register the completion handler via the low-level server API
// (to use custom logic) and must mark the flag so that any later Completable() field usage
// does not trigger a second setRequestHandler call for the same method.

if (process.env.NODE_ENV !== 'production') {
    config();
}

export * from './interfaces';

export const server = new McpServer({
    name: "family-serve-delicious",
    version: "1.0.0"
}, {
    capabilities: {
        logging: {}
    }
});

export { setDatabase, groupResourceHandler, groupResourceList };


const { name: resName, template, meta, handler } = groupResource();
server.registerResource(resName, template, meta, handler);

export const wrapHandlerWithValidation = (
    handler: (args: unknown) => Promise<ToolResult<Record<string, unknown>>>,
    toolName: string
) => {
    return async (args: unknown, extra: unknown): Promise<ToolResult<Record<string, unknown>>> => {
        let result: ToolResult<Record<string, unknown>>;
        try {
            result = await handler(args);
        } catch (err) {
            if (err instanceof McpError) throw err;
            throw new McpError(ErrorCode.InternalError, `Unexpected error in ${toolName}: ${String(err)}`);
        }
        const validation = OutputValidator.validateOutput(result, { toolName });
        if (!validation.safe) {
            console.warn(`Output validation warnings for ${toolName}:`, validation.warnings);
            const strictness = OutputValidator.getStrictness();
            if (strictness === 'mask') {
                return OutputValidator.maskPII(result) as ToolResult<Record<string, unknown>>;
            }
            if (strictness === 'block') {
                throw new McpError(ErrorCode.InternalError, `Output blocked for ${toolName}: ${validation.warnings.join('; ')}`);
            }
        }
        return result;
    };
};

for (const tool of allGroupTools()) {
    const wrappedHandler = wrapHandlerWithValidation(
        tool.handler as unknown as (args: unknown) => Promise<ToolResult<Record<string, unknown>>>,
        tool.name
    );
    server.registerTool(tool.name, {
        description: tool.meta.description,
        inputSchema: tool.meta.inputSchema,
        outputSchema: tool.meta.outputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, wrappedHandler);
}

for (const prompt of allFamilyPrompts()) {
    server.registerPrompt(prompt.name, prompt.meta, prompt.handler);
}

// Register our custom completion handler at the low-level layer so we can supply
// static language values and DB-backed groupId prefix matching.  We then set the
// McpServer._completionHandlerInitialized flag so that any future use of
// Completable() fields on a prompt or resource does NOT attempt to call
// setRequestHandler a second time for the same method (which would throw).
server.server.registerCapabilities({ completions: {} });
server.server.setRequestHandler(CompleteRequestSchema, async (request) => {
    const { argument } = request.params;

    if (argument.name === 'language') {
        const all = ['en', 'fr', 'es'];
        return {
            completion: {
                values: all.filter(l => l.startsWith(argument.value))
            }
        };
    }

    if (argument.name === 'groupId') {
        try {
            const groups = await getDatabase().getGroupService().listGroups();
            const matches = groups
                .filter((g: { id: string }) => g.id.startsWith(argument.value))
                .map((g: { id: string }) => g.id)
                .slice(0, 10);
            return { completion: { values: matches } };
        } catch {
            return { completion: { values: [] } };
        }
    }

    return { completion: { values: [] } };
});
// Mark the flag so McpServer.setCompletionRequestHandler() becomes a no-op if called
// later (e.g. when Completable() fields are added to prompts or resources).
(server as unknown as { _completionHandlerInitialized: boolean })._completionHandlerInitialized = true;

const start = async () => {
    try {
        initializePromptCache(path.join(__dirname, 'prompts'));

        if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be defined in environment variables');
        await initializeDatabase(process.env.MONGODB_URI);
        console.error('Successfully connected to MongoDB');

        const transport = new StdioServerTransport();
        await server.connect(transport);

        // After connect — client can receive log messages
        await server.sendLoggingMessage({ level: 'info', data: 'MCP Server started successfully' });
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
};

process.on('SIGINT', async () => {
    try {
        try {
            await server.sendLoggingMessage({ level: 'info', data: 'Shutting down: disconnecting from MongoDB' });
        } catch { /* transport may not be connected in test context */ }
        await OutputValidator.closeLogger();
        await disconnectDatabase();
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
