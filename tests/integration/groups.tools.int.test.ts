process.env.NODE_ENV = 'test';
import { jest } from '@jest/globals';
export { };

// Mock DB package enums to satisfy imports
await jest.unstable_mockModule('@axyor/family-serve-database', () => ({
    Database: class Database { },
    EGender: { MALE: 'MALE', FEMALE: 'FEMALE' },
    EGroupRole: { ADMIN: 'ADMIN', MEMBER: 'MEMBER' },
    EDietaryRestrictionType: { FORBIDDEN: 'FORBIDDEN', REDUCED: 'REDUCED' },
    EDietaryRestriction: {
        VEGETARIAN: 'VEGETARIAN', VEGAN: 'VEGAN', GLUTEN_FREE: 'GLUTEN_FREE',
        DAIRY_FREE: 'DAIRY_FREE', NO_PORK: 'NO_PORK', LOW_CARB: 'LOW_CARB'
    },
    EActivityLevel: { SEDENTARY: 'SEDENTARY' },
    EHealthGoal: { WEIGHT_LOSS: 'WEIGHT_LOSS' },
    EBudgetLevel: { LOW: 'LOW' },
    ECookingSkill: { BEGINNER: 'BEGINNER' },
    default: class Database { },
}));

// Use explicit relative specifiers ending with .js (mapped by Jest to .ts)
const { setDatabase } = await import('../../src/index.js');
const { allGroupTools } = await import('../../src/tools/group.tools.js');

// Build a lookup of tool handlers
const toolMap: Record<string, any> = {};
for (const t of allGroupTools()) toolMap[t.name] = t.handler;

// Mock data
const mkMember = (i: number) => ({
    id: `m-${i}`,
    role: 'MEMBER',
    firstName: `F${i}`,
    lastName: `L${i}`,
    age: 20 + i,
    gender: 'MALE',
    weightKg: 70 + i,
    heightCm: 170 + i,
    activityLevel: 'SEDENTARY',
    healthGoals: [],
    cuisinePreferences: [],
    mealFrequency: undefined,
    fastingWindow: undefined,
});

const groups = [
    { id: 'g1', name: 'Alpha', members: [mkMember(1), mkMember(2)] },
    { id: 'g2', name: 'Beta', members: [mkMember(3)] },
    { id: 'g3', name: 'Gamma', members: [] },
];

class MockGroupService {
    listGroups = jest.fn(async () => groups);
    findByName = jest.fn(async (name: string) => groups.find(g => g.name === name) || null);
    getGroup = jest.fn(async (id: string) => groups.find(g => g.id === id) || null);
}
class MockDatabase {
    svc = new MockGroupService();
    getGroupService() { return this.svc; }
    disconnect = jest.fn(async () => { });
}

describe('groups tools', () => {
    beforeAll(() => {
        setDatabase(new MockDatabase() as any);
    });

    test('groups-summary returns minimal data without members', async () => {
        const res: any = await toolMap['groups-summary']({ limit: 10 });
        const payload = JSON.parse(res.content[0].text);
        expect(payload.type).toBe('groups-summary');
        expect(payload.groups.length).toBe(3);
        expect(payload.groups[0].members).toBeUndefined();
    });

    test('groups-full without includeMembers excludes members arrays', async () => {
        const res: any = await toolMap['groups-full']({ limit: 10 });
        const payload = JSON.parse(res.content[0].text);
        expect(payload.type).toBe('groups-full');
        expect(payload.includeMembers).toBe(false);
        expect(payload.groups[0].members).toBeUndefined();
    });

    test('groups-full with includeMembers includes members arrays', async () => {
        const res: any = await toolMap['groups-full']({ limit: 5, includeMembers: true });
        const payload = JSON.parse(res.content[0].text);
        expect(payload.includeMembers).toBe(true);
        const g1 = payload.groups.find((g: any) => g.id === 'g1');
        expect(g1.members.length).toBe(2);
    });

    test('group-full returns a single group with members', async () => {
        const res: any = await toolMap['group-full']({ id: 'g2' });
        const payload = JSON.parse(res.content[0].text);
        expect(payload.type).toBe('group-full');
        expect(payload.data.id).toBe('g2');
        expect(payload.data.members[0].id).toBe('m-3');
    });
});
