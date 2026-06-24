process.env.NODE_ENV = 'test';

jest.mock('@axyor/family-serve-database', () => ({
    Database: class Database {},
    default: class Database {},
}));

import { CompleteRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { setDatabase } from '../../src/index';

const groups = [
    { id: 'abc-123', name: 'Family Alpha', members: [] },
    { id: 'abc-456', name: 'Family Beta', members: [] },
    { id: 'xyz-789', name: 'Friends', members: [] },
];

class MockGroupService {
    listGroups = jest.fn(async () => groups);
    getGroup = jest.fn(async (id: string) => groups.find(g => g.id === id) || null);
    findByName = jest.fn(async () => null);
}

class MockDatabase {
    svc = new MockGroupService();
    getGroupService() { return this.svc; }
    disconnect = jest.fn(async () => {});
}

describe('Argument completions', () => {
    let handler: (req: any) => Promise<any>;

    beforeAll(() => {
        setDatabase(new MockDatabase() as any);
        // Access the completion handler registered on the underlying server
        const { server } = require('../../src/index');
        // Simulate completion request using the registered handler
        handler = async (req: any) => {
            // Call through the server's request handler mechanism
            return server.server._requestHandlers?.get(CompleteRequestSchema.shape.method.value)?.(req, {});
        };
    });

    test('language completion filters by prefix', async () => {
        const result = await handler({
            method: 'completion/complete',
            params: { ref: { type: 'ref/prompt', name: 'meal-planning-system' }, argument: { name: 'language', value: 'f' } }
        });
        expect(result.completion.values).toEqual(['fr']);
    });

    test('language completion returns all when empty prefix', async () => {
        const result = await handler({
            method: 'completion/complete',
            params: { ref: { type: 'ref/prompt', name: 'meal-planning-system' }, argument: { name: 'language', value: '' } }
        });
        expect(result.completion.values).toEqual(expect.arrayContaining(['en', 'fr', 'es']));
    });

    test('groupId completion filters groups by id prefix', async () => {
        const result = await handler({
            method: 'completion/complete',
            params: { ref: { type: 'ref/prompt', name: 'meal-planning-system' }, argument: { name: 'groupId', value: 'abc' } }
        });
        expect(result.completion.values).toEqual(expect.arrayContaining(['abc-123', 'abc-456']));
        expect(result.completion.values).not.toContain('xyz-789');
    });

    test('unknown argument returns empty values', async () => {
        const result = await handler({
            method: 'completion/complete',
            params: { ref: { type: 'ref/prompt', name: 'meal-planning-system' }, argument: { name: 'limit', value: '1' } }
        });
        expect(result.completion.values).toEqual([]);
    });
});
