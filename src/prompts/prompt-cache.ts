import fs from 'fs';
import path from 'path';
import { Language, PromptFormat } from '../interfaces';

const LANGUAGES: Language[] = ['en', 'fr', 'es'];
const FORMATS: PromptFormat[] = ['full', 'short', 'template'];

let cache: Map<string, string> | null = null;

const resolveFilename = (lang: Language, format: PromptFormat): string => {
    if (format === 'full') return lang === 'en' ? 'system-full.md' : `system-full.${lang}.md`;
    if (format === 'short') return lang === 'en' ? 'system.short.md' : `system.short.${lang}.md`;
    return lang === 'en' ? 'system.template.json' : `system.template.${lang}.json`;
};

export const initializePromptCache = (promptsDir: string): void => {
    const next = new Map<string, string>();
    for (const lang of LANGUAGES) {
        for (const format of FORMATS) {
            const filePath = path.join(promptsDir, lang, resolveFilename(lang, format));
            next.set(`${lang}:${format}`, fs.readFileSync(filePath, 'utf-8'));
        }
    }
    cache = next;
};

export const getCachedPrompt = (lang: Language, format: PromptFormat): string => {
    if (!cache) throw new Error('Prompt cache not initialized');
    const content = cache.get(`${lang}:${format}`);
    if (content === undefined) throw new Error(`No cached prompt for ${lang}:${format}`);
    return content;
};
