// Ensure we don't auto-start the server in tests
process.env.NODE_ENV = 'test';
import { jest } from '@jest/globals';
export {};

// Mock the DB package to avoid loading mongoose
await jest.unstable_mockModule('@axyor/family-serve-database', () => ({
  Database: class Database {},
  EGender: { MALE: 'MALE', FEMALE: 'FEMALE' },
  EGroupRole: { ADMIN: 'ADMIN', MEMBER: 'MEMBER' },
  EDietaryRestrictionType: { FORBIDDEN: 'FORBIDDEN', REDUCED: 'REDUCED' },
  EDietaryRestriction: {
    VEGETARIAN: 'VEGETARIAN', VEGAN: 'VEGAN', GLUTEN_FREE: 'GLUTEN_FREE',
    DAIRY_FREE: 'DAIRY_FREE', NO_PORK: 'NO_PORK', LOW_CARB: 'LOW_CARB'
  },
  default: class Database {},
}));

const mod = await import('../../src/index');

class MockDatabase {
  disconnect = jest.fn(async () => {});
}

describe('Unit: graceful shutdown', () => {
  test('SIGINT triggers db.disconnect and process.exit(0)', async () => {
    const mockDb = new MockDatabase() as any;
    mod.setDatabase(mockDb);

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);

    // Emit SIGINT and wait a tick for async handler
    process.emit('SIGINT');
    await new Promise((r) => setImmediate(r));

    expect(mockDb.disconnect).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);

    exitSpy.mockRestore();
  });
});
