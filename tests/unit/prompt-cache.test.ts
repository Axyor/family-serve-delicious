process.env.NODE_ENV = 'test';

import path from 'path';

describe('Prompt cache', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    test('getCachedPrompt returns content after initializePromptCache', () => {
        const { initializePromptCache, getCachedPrompt } = require('../../src/prompts/prompt-cache');
        initializePromptCache(path.join(__dirname, '../../src/prompts'));
        const content = getCachedPrompt('en', 'full');
        expect(typeof content).toBe('string');
        expect(content.length).toBeGreaterThan(0);
    });

    test('getCachedPrompt throws if cache not initialized', () => {
        const { getCachedPrompt } = require('../../src/prompts/prompt-cache');
        expect(() => getCachedPrompt('en', 'full')).toThrow('Prompt cache not initialized');
    });

    test('initializePromptCache throws on missing prompt file', () => {
        const { initializePromptCache } = require('../../src/prompts/prompt-cache');
        expect(() => initializePromptCache('/nonexistent/path')).toThrow();
    });
});
