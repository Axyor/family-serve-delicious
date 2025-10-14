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

const { setDatabase: importedSetDatabase, server } = require('../../src/index');

class ITMockDatabase {
    disconnect = jest.fn(async () => { });
    getGroupService() { 
        return {
            listGroups: jest.fn(async () => []),
            getGroup: jest.fn(async () => null)
        };
    }
}

describe('MCP Server Prompts Integration', () => {
    beforeAll(() => {
        importedSetDatabase(new ITMockDatabase() as any);
    });

    test('server should register all family prompts', () => {
        // Test that the prompts are properly registered by checking internal structure
        // This is a integration test - we verify that prompts exist and are callable
        
        // Access prompt handlers directly (internal testing approach)
        const allPrompts = require('../../src/prompts/family.prompts').allFamilyPrompts();
        
        expect(allPrompts).toHaveLength(4);
        
        const promptNames = allPrompts.map((p: any) => p.name);
        expect(promptNames).toContain('meal-planning-system');
        expect(promptNames).toContain('plan-family-meals');
        expect(promptNames).toContain('quick-meal-suggestions');
        expect(promptNames).toContain('weekly-meal-plan');
    });

    test('prompts should have correct metadata structure', () => {
        const allPrompts = require('../../src/prompts/family.prompts').allFamilyPrompts();
        
        for (const prompt of allPrompts) {
            expect(prompt).toHaveProperty('name');
            expect(prompt).toHaveProperty('meta');
            expect(prompt).toHaveProperty('handler');
            
            expect(typeof prompt.name).toBe('string');
            expect(typeof prompt.meta).toBe('object');
            expect(typeof prompt.handler).toBe('function');
            
            expect(prompt.meta).toHaveProperty('title');
            expect(prompt.meta).toHaveProperty('description');
            
            expect(typeof prompt.meta.title).toBe('string');
            expect(typeof prompt.meta.description).toBe('string');
            expect(prompt.name.length).toBeGreaterThan(0);
            expect(prompt.meta.title.length).toBeGreaterThan(0);
            expect(prompt.meta.description.length).toBeGreaterThan(0);
        }
    });

    test('meal-planning-system prompt should be callable', async () => {
        const allPrompts = require('../../src/prompts/family.prompts').allFamilyPrompts();
        const mealPlanningPrompt = allPrompts.find((p: any) => p.name === 'meal-planning-system');
        
        expect(mealPlanningPrompt).toBeDefined();
        
        const result = await mealPlanningPrompt.handler({ 
            language: 'en', 
            format: 'short' 
        });
        
        expect(result).toHaveProperty('messages');
        expect(Array.isArray(result.messages)).toBe(true);
        expect(result.messages.length).toBeGreaterThan(0);
        
        const firstMessage = result.messages[0];
        expect(firstMessage).toHaveProperty('role', 'user');
        expect(firstMessage).toHaveProperty('content');
        expect(firstMessage.content).toHaveProperty('type', 'text');
        expect(firstMessage.content).toHaveProperty('text');
        expect(typeof firstMessage.content.text).toBe('string');
        expect(firstMessage.content.text.length).toBeGreaterThan(0);
    });

    test('plan-family-meals prompt should handle parameters correctly', async () => {
        const allPrompts = require('../../src/prompts/family.prompts').allFamilyPrompts();
        const planFamilyMealsPrompt = allPrompts.find((p: any) => p.name === 'plan-family-meals');
        
        expect(planFamilyMealsPrompt).toBeDefined();
        
        const result = await planFamilyMealsPrompt.handler({
            groupId: 'test-group',
            mealType: 'dinner',
            servings: 4,
            budget: 'medium',
            language: 'fr',
            format: 'full'
        });
        
        expect(result).toHaveProperty('messages');
        expect(Array.isArray(result.messages)).toBe(true);
        expect(result.messages.length).toBeGreaterThan(0);
        
        const messageText = result.messages[0].content.text;
        
        // Should contain the parameters we passed
        expect(messageText).toContain('test-group');
        expect(messageText).toContain('dinner');
        expect(messageText).toContain('4');
        expect(messageText).toContain('medium');
        
        // Should be in French since we specified language: 'fr'
        expect(messageText).toContain('famille');
    });

    test('quick-meal-suggestions prompt should work with minimal parameters', async () => {
        const allPrompts = require('../../src/prompts/family.prompts').allFamilyPrompts();
        const quickMealPrompt = allPrompts.find((p: any) => p.name === 'quick-meal-suggestions');
        
        expect(quickMealPrompt).toBeDefined();
        
        const result = await quickMealPrompt.handler({
            maxTime: 30
        });
        
        expect(result).toHaveProperty('messages');
        expect(Array.isArray(result.messages)).toBe(true);
        expect(result.messages.length).toBeGreaterThan(0);
        
        const messageText = result.messages[0].content.text;
        expect(messageText).toContain('30');
        expect(messageText).toContain('minutes');
    });

    test('weekly-meal-plan prompt should handle week planning', async () => {
        const allPrompts = require('../../src/prompts/family.prompts').allFamilyPrompts();
        const weeklyMealPrompt = allPrompts.find((p: any) => p.name === 'weekly-meal-plan');
        
        expect(weeklyMealPrompt).toBeDefined();
        
        const result = await weeklyMealPrompt.handler({
            groupId: 'weekly-test-group',
            days: 5,
            includeBreakfast: true,
            includeLunch: true,
            includeDinner: true,
            language: 'es'
        });
        
        expect(result).toHaveProperty('messages');
        expect(Array.isArray(result.messages)).toBe(true);
        expect(result.messages.length).toBeGreaterThan(0);
        
        const messageText = result.messages[0].content.text;
        expect(messageText).toContain('weekly-test-group');
        expect(messageText).toContain('5 days');
        expect(messageText).toContain('breakfast, lunch, dinner');
        
        // Should be in Spanish since we specified language: 'es'
        expect(messageText).toContain('familia');
    });
});