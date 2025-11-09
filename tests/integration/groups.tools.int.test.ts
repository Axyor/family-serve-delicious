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
    EActivityLevel: { SEDENTARY: 'SEDENTARY' },
    EHealthGoal: { WEIGHT_LOSS: 'WEIGHT_LOSS' },
    EBudgetLevel: { LOW: 'LOW' },
    ECookingSkill: { BEGINNER: 'BEGINNER' },
    default: class Database { },
}));

let toolMap: Record<string, any> = {};
const { setDatabase: importedSetDatabase } = require('../../src/index');
const { allGroupTools } = require('../../src/tools/group.tools');
for (const t of allGroupTools()) toolMap[t.name] = t.handler;


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
            mkMember(1, { cuisinePreferences: ['Italian', 'Thai'], dietaryProfile: { preferences: { likes: [], dislikes: ['cilantro'] }, allergies: ['Peanuts'], restrictions: [{ type: 'FORBIDDEN', reason: 'NO_PORK' }, { type: 'REDUCED', reason: 'LOW_CARB' }] } }),
            mkMember(2, { cuisinePreferences: ['thai', 'Japanese'], dietaryProfile: { preferences: { likes: [], dislikes: ['okra'] }, allergies: ['peanuts', 'Shellfish'], restrictions: [{ type: 'FORBIDDEN', reason: 'GLUTEN_FREE' }] } }),
        ]
    },
    { id: 'g2', name: 'Beta', members: [mkMember(3)] },
    { id: 'g3', name: 'Gamma', members: [] },

    { 
        id: 'g4', name: 'NewFormat', members: [
            mkMember(4, { 
                dietaryProfile: { 
                    preferences: { likes: ['pasta', 'sushi'], dislikes: ['mushrooms', 'olives'] }, 
                    allergies: ['eggs'], 
                    restrictions: [{ type: 'REDUCED', reason: 'sugar' }] 
                } 
            })
        ]
    },
];

class ITMockGroupService {
    listGroups = jest.fn(async () => groups);
    findByName = jest.fn(async (name: string) => groups.find(g => g.name === name) || null);
    getGroup = jest.fn(async (id: string) => groups.find(g => g.id === id) || null);
}
class ITMockDatabase {
    svc = new ITMockGroupService();
    getGroupService() { return this.svc; }
    disconnect = jest.fn(async () => { });
}

describe('groups tools', () => {
    beforeAll(() => {
        importedSetDatabase(new ITMockDatabase() as any);
    });

    test('groups-summary returns minimal data without members', async () => {
        const res: any = await toolMap['groups-summary']({ limit: 10 });
        const payload = JSON.parse(res.content[0].text);
        expect(payload.type).toBe('groups-summary');
        expect(payload.groups.length).toBe(4);
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

        const peanutAllergy = payload.allergies.find((a: any) => a.substance === 'peanut');
        expect(peanutAllergy.count).toBe(2);
        expect(new Set(peanutAllergy.members)).toEqual(new Set(['m-1', 'm-2']));
        expect(payload.hardRestrictions).toEqual(expect.arrayContaining(['GLUTEN_FREE', 'NO_PORK']));
        expect(payload.softRestrictions).toEqual(expect.arrayContaining(['LOW_CARB']));

        expect(payload.softPreferences.cuisinesLiked).toEqual(expect.arrayContaining(['italian', 'japanese', 'thai']));
        expect(payload.softPreferences.dislikes).toEqual(expect.arrayContaining(['cilantro', 'okra']));
    });

    test('group-recipe-context handles new v2.2.0 preferences format (likes/dislikes object)', async () => {
        const res: any = await toolMap['group-recipe-context']({ id: 'g4' });
        const payload = JSON.parse(res.content[0].text);
        expect(payload.type).toBe('group-recipe-context');
        expect(payload.group.id).toBe('g4');
        expect(payload.members.length).toBe(1);

        expect(payload.softPreferences?.cuisinesLiked).toEqual(expect.arrayContaining(['pasta', 'sushi']));
        expect(payload.softPreferences?.dislikes).toEqual(expect.arrayContaining(['mushrooms', 'olives']));
        
        const eggAllergy = payload.allergies.find((a: any) => a.substance === 'egg');
        expect(eggAllergy).toBeDefined();
        expect(eggAllergy.count).toBe(1);
        
        expect(payload.softRestrictions).toEqual(expect.arrayContaining(['sugar']));
    });
});
