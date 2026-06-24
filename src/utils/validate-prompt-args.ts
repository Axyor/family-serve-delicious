import { z, ZodRawShape } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export const validatePromptArgs = <T>(schema: ZodRawShape, args: unknown): T => {
    const result = z.object(schema).safeParse(args);
    if (!result.success) {
        const message = result.error.issues
            .map(e => `${e.path.join('.')}: ${e.message}`)
            .join('; ');
        throw new McpError(ErrorCode.InvalidParams, `Invalid prompt arguments: ${message}`);
    }
    return result.data as T;
};
