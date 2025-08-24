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
const mkMember = (i: number, extras: any = {}) => ({
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
    dietaryProfile: undefined,
    ...extras,
});

const groups = [
    {
        id: 'g1', name: 'Alpha', members: [
            mkMember(1, { cuisinePreferences: ['Italian', 'Thai'], dietaryProfile: { preferences: ['avoid cilantro'], allergies: ['Peanuts'], restrictions: [{ type: 'FORBIDDEN', reason: 'NO_PORK' }, { type: 'REDUCED', reason: 'LOW_CARB' }] } }),
            mkMember(2, { cuisinePreferences: ['thai', 'Japanese'], dietaryProfile: { preferences: ['dislike okra'], allergies: ['peanuts', 'Shellfish'], restrictions: [{ type: 'FORBIDDEN', reason: 'GLUTEN_FREE' }] } }),
        ]
    },
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

    test('group-recipe-context returns anonymized context with aggregated allergies/restrictions', async () => {
        const res: any = await toolMap['group-recipe-context']({ id: 'g1' });
        const payload = JSON.parse(res.content[0].text);
        expect(payload.type).toBe('group-recipe-context');
        expect(payload.group.id).toBe('g1');
        expect(payload.members.length).toBe(2);
        expect(payload.members[0].alias).toBeDefined();
        expect(payload.hash).toMatch(/^sha256:/);
        // Aggregation checks
        const peanutAllergy = payload.allergies.find((a: any) => a.substance === 'peanut');
        expect(peanutAllergy.count).toBe(2);
        expect(new Set(peanutAllergy.members)).toEqual(new Set(['m-1', 'm-2']));
        expect(payload.hardRestrictions).toEqual(expect.arrayContaining(['GLUTEN_FREE', 'NO_PORK']));
        expect(payload.softRestrictions).toEqual(expect.arrayContaining(['LOW_CARB']));
        // Preferences
        expect(payload.softPreferences.cuisinesLiked).toEqual(expect.arrayContaining(['italian', 'japanese', 'thai']));
        expect(payload.softPreferences.dislikes).toEqual(expect.arrayContaining(['cilantro', 'okra']));
    });
});
