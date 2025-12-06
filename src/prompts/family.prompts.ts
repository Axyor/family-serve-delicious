import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { PromptMeta, PromptDefinition, Language, PromptFormat } from '../interfaces';

const readPromptFile = (language: Language, format: PromptFormat): string => {
    const promptsDir = path.join(__dirname, '..', 'prompts');
    let filename: string;

    switch (format) {
        case 'full':
            filename = language === 'en' ? 'system-full.md' : `system-full.${language}.md`;
            break;
        case 'short':
            filename = language === 'en' ? 'system.short.md' : `system.short.${language}.md`;
            break;
        case 'template':
            filename = language === 'en' ? 'system.template.json' : `system.template.${language}.json`;
            break;
    }

    const filePath = path.join(promptsDir, language, filename);

    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
        throw new Error(`Unable to read prompt file: ${filePath}`);
    }
};

export const mealPlanningSystemPromptHandler = async (args: Record<string, unknown>) => {
    const { language = 'en', format = 'full', groupId } = args as {
        language?: Language;
        format?: PromptFormat;
        groupId?: string;
    };

    let promptContent = readPromptFile(language, format);

    if (groupId) {
        const contextNote = `\n\n## Current Group Context\nTarget Group ID: ${groupId}\nUse this ID directly with the MCP tools (group-recipe-context).\n`;
        promptContent += contextNote;
    } else {
        const inferenceNote = `\n\n## Smart Group Inference Required\nNo specific group was provided. Use smart inference:\n1. Call groups-summary to see available groups\n2. If only 1 group exists, auto-select it with brief confirmation\n3. If multiple groups, intelligently pick based on context or ask briefly\n4. Remember the selected group for conversation continuity\n`;
        promptContent += inferenceNote;
    }

    return {
        messages: [
            {
                role: 'user' as const,
                content: {
                    type: 'text' as const,
                    text: promptContent
                }
            }
        ]
    };
};

export const constraintAwareMealPlanningHandler = async (args: Record<string, unknown>) => {
    const {
        language = 'en',
        groupId,
        mealType,
        servings,
        budget,
        cuisinePreference
    } = args as {
        language?: Language;
        groupId?: string;
        mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
        servings?: number;
        budget?: 'low' | 'medium' | 'high';
        cuisinePreference?: string;
    };

    const templateContent = readPromptFile(language, 'template');
    const template = JSON.parse(templateContent);

    let promptText = readPromptFile(language, 'full');

    const instructions = [`\n\n## Current Planning Task`];

    if (groupId) {
        instructions.push(`Target Group ID: ${groupId}`);
        instructions.push(`Use group-recipe-context with this ID to load group constraints.`);
    } else {
        instructions.push(`No specific group provided - use smart inference:`);
        instructions.push(`1. Call groups-summary to see available groups`);
        instructions.push(`2. Auto-select if only 1 group, or pick most likely based on context`);
        instructions.push(`3. Briefly confirm: "Planning for [Group Name]..."`);
    }

    if (mealType) {
        instructions.push(`Meal Type: ${mealType}`);
        instructions.push(`Focus on ${mealType}-appropriate dishes and timing.`);
    }

    if (servings) {
        instructions.push(`Target Servings: ${servings}`);
        instructions.push(`Scale recipes and portions accordingly.`);
    }

    if (budget) {
        instructions.push(`Budget Level: ${budget}`);
        instructions.push(`Consider cost-effective ingredients and preparation methods.`);
    }

    if (cuisinePreference) {
        instructions.push(`Cuisine Preference: ${cuisinePreference}`);
        instructions.push(`Prioritize ${cuisinePreference} dishes while respecting all dietary constraints.`);
    }

    instructions.push(`\nRemember: Safety first! Exclude ALL allergens and FORBIDDEN restrictions.`);

    promptText += instructions.join('\n');

    return {
        messages: [
            {
                role: 'user' as const,
                content: {
                    type: 'text' as const,
                    text: promptText
                }
            }
        ]
    };
};

export const quickMealSuggestionHandler = async (args: Record<string, unknown>) => {
    const { language = 'en', groupId } = args as {
        language?: Language;
        groupId?: string;
    };

    const shortPrompt = readPromptFile(language, 'short');

    let quickInstructions = `
${shortPrompt}

## Quick Meal Task
`;

    if (groupId) {
        quickInstructions += `Target Group: ${groupId}\n\n`;
    } else {
        quickInstructions += `No group specified - use smart inference to resolve the target group first.\n\n`;
    }

    quickInstructions += `Please provide 3-5 quick meal suggestions that are:
1. Safe for all group members (check group-recipe-context)
2. Easy to prepare (30 minutes or less)
3. Use common ingredients
4. Include variety in proteins and cuisines

Format: Brief meal name, key ingredients, prep time, why it works for this group.
`;

    return {
        messages: [
            {
                role: 'user' as const,
                content: {
                    type: 'text' as const,
                    text: quickInstructions
                }
            }
        ]
    };
};

export const weeklyMealPlanHandler = async (args: Record<string, unknown>) => {
    const {
        language = 'en',
        groupId,
        days = 7,
        includeBreakfast = false,
        includeLunch = true,
        includeDinner = true
    } = args as {
        language?: Language;
        groupId?: string;
        days?: number;
        includeBreakfast?: boolean;
        includeLunch?: boolean;
        includeDinner?: boolean;
    };

    const fullPrompt = readPromptFile(language, 'full');

    const meals = [];
    if (includeBreakfast) meals.push('breakfast');
    if (includeLunch) meals.push('lunch');
    if (includeDinner) meals.push('dinner');

    let weeklyInstructions = `
${fullPrompt}

## Weekly Meal Planning Task
`;

    if (groupId) {
        weeklyInstructions += `Target Group: ${groupId}\n`;
    } else {
        weeklyInstructions += `No group specified - resolve target group using smart inference first.\n`;
    }

    weeklyInstructions += `Planning Duration: ${days} days
Meals to Plan: ${meals.join(', ')}

WORKFLOW:
1. ${groupId ? `Load group-recipe-context for ${groupId}` : 'Resolve target group, then load group-recipe-context'}
2. Create a ${days}-day meal plan covering: ${meals.join(', ')}
3. Ensure variety in proteins, cuisines, and cooking methods
4. Balance nutritional needs across the week
5. Consider prep time and cooking skill levels
6. Generate a consolidated shopping list

OUTPUT FORMAT:
- Day-by-day meal schedule
- Key constraints satisfied
- Nutritional balance notes
- Shopping list organized by category
- Prep time estimates
`;

    return {
        messages: [
            {
                role: 'user' as const,
                content: {
                    type: 'text' as const,
                    text: weeklyInstructions
                }
            }
        ]
    };
};

export const allFamilyPrompts = (): PromptDefinition[] => [
    {
        name: 'meal-planning-system',
        meta: {
            title: 'Meal Planning System Prompt',
            description: 'Comprehensive system prompt for constraint-aware meal planning with smart group inference',
            argsSchema: {
                language: z.enum(['en', 'fr', 'es']).optional(),
                format: z.enum(['full', 'short', 'template']).optional(),
                groupId: z.string().optional()
            }
        },
        handler: mealPlanningSystemPromptHandler
    },
    {
        name: 'plan-family-meals',
        meta: {
            title: 'Plan Family Meals',
            description: 'Generate meal suggestions with dietary constraints and preferences. GroupId optional - will use smart inference if not provided.',
            argsSchema: {
                groupId: z.string().optional(),
                language: z.enum(['en', 'fr', 'es']).optional(),
                mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
                servings: z.number().int().positive().optional(),
                budget: z.enum(['low', 'medium', 'high']).optional(),
                cuisinePreference: z.string().optional()
            }
        },
        handler: constraintAwareMealPlanningHandler
    },
    {
        name: 'quick-meal-suggestions',
        meta: {
            title: 'Quick Meal Suggestions',
            description: 'Get quick, easy meal ideas. GroupId optional - will auto-resolve if not provided.',
            argsSchema: {
                groupId: z.string().optional(),
                language: z.enum(['en', 'fr', 'es']).optional()
            }
        },
        handler: quickMealSuggestionHandler
    },
    {
        name: 'weekly-meal-plan',
        meta: {
            title: 'Weekly Meal Plan',
            description: 'Create a comprehensive weekly meal plan with shopping list. GroupId optional - will use smart inference.',
            argsSchema: {
                groupId: z.string().optional(),
                language: z.enum(['en', 'fr', 'es']).optional(),
                days: z.number().int().min(1).max(14).optional(),
                includeBreakfast: z.boolean().optional(),
                includeLunch: z.boolean().optional(),
                includeDinner: z.boolean().optional()
            }
        },
        handler: weeklyMealPlanHandler
    }
];