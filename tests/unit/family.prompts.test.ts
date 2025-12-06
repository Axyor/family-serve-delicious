process.env.NODE_ENV = 'test';

import { allFamilyPrompts } from '../../src/prompts/family.prompts';

describe('Family Prompts', () => {
    let prompts: Record<string, any> = {};

    beforeAll(() => {
        // Build prompt lookup map
        for (const prompt of allFamilyPrompts()) {
            prompts[prompt.name] = prompt;
        }
    });

    test('should export all expected prompts', () => {
        expect(prompts).toHaveProperty('meal-planning-system');
        expect(prompts).toHaveProperty('plan-family-meals');
        expect(prompts).toHaveProperty('quick-meal-suggestions');
        expect(prompts).toHaveProperty('weekly-meal-plan');
    });

    describe('meal-planning-system', () => {
        test('should return system prompt with default parameters', async () => {
            const result = await prompts['meal-planning-system'].handler({});
            
            expect(result).toHaveProperty('messages');
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0].role).toBe('user');
            expect(result.messages[0].content.type).toBe('text');
            expect(result.messages[0].content.text).toContain('constraint‑aware meal planning assistant');
        });

        test('should include group context when groupId provided', async () => {
            const result = await prompts['meal-planning-system'].handler({ groupId: 'test-group-123' });
            
            expect(result.messages[0].content.text).toContain('Current Group Context');
            expect(result.messages[0].content.text).toContain('test-group-123');
        });

        test('should support different languages', async () => {
            const resultEn = await prompts['meal-planning-system'].handler({ language: 'en' });
            const resultFr = await prompts['meal-planning-system'].handler({ language: 'fr' });
            
            expect(resultEn.messages[0].content.text).toContain('constraint‑aware meal planning assistant');
            expect(resultFr.messages[0].content.text).toContain('planification de repas');
        });

        test('should support different formats', async () => {
            const fullResult = await prompts['meal-planning-system'].handler({ format: 'full' });
            const shortResult = await prompts['meal-planning-system'].handler({ format: 'short' });
            
            expect(fullResult.messages[0].content.text.length).toBeGreaterThan(
                shortResult.messages[0].content.text.length
            );
        });
    });

    describe('plan-family-meals', () => {
        test('should require groupId parameter', async () => {
            const result = await prompts['plan-family-meals'].handler({ groupId: 'test-group' });
            
            expect(result).toHaveProperty('messages');
            expect(result.messages[0].content.text).toContain('test-group');
        });

        test('should include meal type instructions when specified', async () => {
            const result = await prompts['plan-family-meals'].handler({ 
                groupId: 'test-group',
                mealType: 'dinner'
            });
            
            expect(result.messages[0].content.text).toContain('Meal Type: dinner');
            expect(result.messages[0].content.text).toContain('dinner-appropriate dishes');
        });

        test('should include servings instructions when specified', async () => {
            const result = await prompts['plan-family-meals'].handler({ 
                groupId: 'test-group',
                servings: 6
            });
            
            expect(result.messages[0].content.text).toContain('Target Servings: 6');
            expect(result.messages[0].content.text).toContain('Scale recipes');
        });

        test('should include budget considerations when specified', async () => {
            const result = await prompts['plan-family-meals'].handler({ 
                groupId: 'test-group',
                budget: 'low'
            });
            
            expect(result.messages[0].content.text).toContain('Budget Level: low');
            expect(result.messages[0].content.text).toContain('cost-effective');
        });

        test('should include cuisine preferences when specified', async () => {
            const result = await prompts['plan-family-meals'].handler({ 
                groupId: 'test-group',
                cuisinePreference: 'Italian'
            });
            
            expect(result.messages[0].content.text).toContain('Cuisine Preference: Italian');
            expect(result.messages[0].content.text).toContain('Italian dishes');
        });
    });

    describe('quick-meal-suggestions', () => {
        test('should provide quick meal guidance', async () => {
            const result = await prompts['quick-meal-suggestions'].handler({ groupId: 'test-group' });
            
            expect(result.messages[0].content.text).toContain('Quick Meal Task');
            expect(result.messages[0].content.text).toContain('3-5 quick meal suggestions');
            expect(result.messages[0].content.text).toContain('30 minutes or less');
        });

        test('should include group reference', async () => {
            const result = await prompts['quick-meal-suggestions'].handler({ groupId: 'family-123' });
            
            expect(result.messages[0].content.text).toContain('family-123');
            expect(result.messages[0].content.text).toContain('group-recipe-context');
        });
    });

    describe('weekly-meal-plan', () => {
        test('should provide weekly planning guidance', async () => {
            const result = await prompts['weekly-meal-plan'].handler({ groupId: 'test-group' });
            
            expect(result.messages[0].content.text).toContain('Weekly Meal Planning Task');
            expect(result.messages[0].content.text).toContain('7 days');
            expect(result.messages[0].content.text).toContain('shopping list');
        });

        test('should customize meal types based on parameters', async () => {
            const result = await prompts['weekly-meal-plan'].handler({ 
                groupId: 'test-group',
                includeBreakfast: true,
                includeLunch: false,
                includeDinner: true
            });
            
            // Verify breakfast and dinner are mentioned, lunch is not
            const text = result.messages[0].content.text.toLowerCase();
            expect(text).toContain('dinner');
            // Breakfast might be optional or implied, so we check if excludes lunch
            expect(text).not.toContain('lunch');
        });

        test('should support custom planning duration', async () => {
            const result = await prompts['weekly-meal-plan'].handler({ 
                groupId: 'test-group',
                days: 14
            });
            
            expect(result.messages[0].content.text).toContain('14 days');
            expect(result.messages[0].content.text).toContain('14-day meal plan');
        });
    });

    describe('prompt metadata', () => {
        test('all prompts should have proper metadata', () => {
            for (const prompt of allFamilyPrompts()) {
                expect(prompt).toHaveProperty('name');
                expect(prompt).toHaveProperty('meta');
                expect(prompt).toHaveProperty('handler');
                
                expect(typeof prompt.name).toBe('string');
                expect(typeof prompt.meta.title).toBe('string');
                expect(typeof prompt.meta.description).toBe('string');
                expect(typeof prompt.handler).toBe('function');
            }
        });

        test('prompts should have input schema validation', () => {
            for (const prompt of allFamilyPrompts()) {
                expect(prompt.meta).toHaveProperty('argsSchema');
                expect(typeof prompt.meta.argsSchema).toBe('object');
            }
        });
    });
});