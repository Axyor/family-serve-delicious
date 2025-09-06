process.env.NODE_ENV = 'test';

jest.mock('@axyor/family-serve-database', () => ({
  Database: class Database { },
  EGender: { MALE: 'MALE', FEMALE: 'FEMALE' },
  EGroupRole: { ADMIN: 'ADMIN', MEMBER: 'MEMBER' },
  EDietaryRestrictionType: { FORBIDDEN: 'FORBIDDEN', REDUCED: 'REDUCED' },
  EDietaryRestriction: {
    VEGETARIAN: 'VEGETARIAN', VEGAN: 'VEGAN', GLUTEN_FREE: 'GLUTEN_FREE',
    DAIRY_FREE: 'DAIRY_FREE', NO_PORK: 'NO_PORK', LOW_CARB: 'LOW_CARB'
  },
  EActivityLevel: { SEDENTARY: 'SEDENTARY', LIGHTLY_ACTIVE: 'LIGHTLY_ACTIVE', MODERATELY_ACTIVE: 'MODERATELY_ACTIVE', VERY_ACTIVE: 'VERY_ACTIVE' },
  EHealthGoal: { WEIGHT_LOSS: 'WEIGHT_LOSS', MUSCLE_GAIN: 'MUSCLE_GAIN', MAINTENANCE: 'MAINTENANCE', IMPROVE_DIGESTION: 'IMPROVE_DIGESTION', HEART_HEALTH: 'HEART_HEALTH' },
  EBudgetLevel: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
  ECookingSkill: { BEGINNER: 'BEGINNER', INTERMEDIATE: 'INTERMEDIATE', ADVANCED: 'ADVANCED' },
  default: class Database { },
}));

const { groupResourceHandler, setDatabase } = require('../../src/index');

type Mock = jest.MockedFunction<any> & ((...args: any[]) => any);

class MockGroupService {
  getGroup: Mock = jest.fn(async (id: string) => id === 'group-1' ? ({ id: 'group-1', name: 'Fam', members: [], updatedAt: new Date(), createdAt: new Date() }) : null);
}

class LocalMockDatabase {
  private svc = new MockGroupService();
  getGroupService() { return this.svc; }
  disconnect = jest.fn(async () => { });
}

describe('Read-only: group resource', () => {
  const mockDb = new LocalMockDatabase() as any;
  beforeAll(() => {
    setDatabase(mockDb);
  });

  test('groupResourceHandler returns serialized group when found', async () => {
    const uri = new URL('groups://group-1');
    const res: any = await groupResourceHandler(uri, { groupId: 'group-1' });
    expect(Array.isArray(res.contents)).toBe(true);
    expect(res.contents[0].uri).toBe(uri.href);
    const parsed = JSON.parse(res.contents[0].text);
    expect(parsed.id).toBe('group-1');
    expect(parsed.name).toBe('Fam');
  });

  test('groupResourceHandler returns empty contents when group not found', async () => {
    const uri = new URL('groups://unknown');
    const res: any = await groupResourceHandler(uri, { groupId: 'unknown' });
    expect(res.contents).toEqual([]);
  });
});
