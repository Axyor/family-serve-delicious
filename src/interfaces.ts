export interface PromptMeta {
    title: string;
    description: string;
    argsSchema?: Record<string, any>;
}

export interface PromptDefinition {
    name: string;
    meta: PromptMeta;
    handler: (args: any) => Promise<{
        messages: Array<{
            role: 'user' | 'assistant';
            content: { type: 'text', text: string };
        }>;
    }>;
}

export type Language = 'en' | 'fr' | 'es';
export type PromptFormat = 'full' | 'short' | 'template';

export interface IAllergyAgg {
    substance: string;
    members: string[];
    count: number;
}

export interface IPrefPatterns {
    dislikeIndicators?: string[];
    avoidIndicators?: string[];
    excludeIndicators?: string[];
    splitDelimitersRegex?: string;
}

export interface IGroupRecipeContextMember {
    id: string;
    alias?: string;
    firstName?: string;
    lastName?: string;
    ageGroup?: string;
}

export interface IGroupRecipeContext {
    type: 'group-recipe-context';
    schemaVersion: 1;
    group: { id: string; name: string; size: number };
    members: IGroupRecipeContextMember[];
    segments: { ageGroups: Record<string, number> };
    allergies: IAllergyAgg[];
    hardRestrictions: string[];
    softRestrictions: string[];
    softPreferences?: { cuisinesLiked?: string[]; dislikes?: string[] };
    stats: { cookingSkillSpread: Record<string, number> };
    hash: string;
}

export interface Counters {
    [k: string]: number
}

// Type compatible with package EDietaryRestrictionType enum
export type TDietaryRestrictionType = 'FORBIDDEN' | 'REDUCED';