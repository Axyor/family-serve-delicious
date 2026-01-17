export interface PromptMeta {
    title: string;
    description: string;
    argsSchema?: Record<string, any>;
}

export interface PromptDefinition {
    name: string;
    meta: PromptMeta;
    handler: (args: Record<string, unknown>) => Promise<{
        messages: Array<{
            role: 'user' | 'assistant';
            content: { type: 'text', text: string };
        }>;
    }>;
}

export type Language = 'en' | 'fr' | 'es';
export type PromptFormat = 'full' | 'short' | 'template';

export interface ResourceContent {
    uri: string;
    text: string;
}

export interface ResourceResult {
    [key: string]: unknown;
    contents: ResourceContent[];
}

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

export type TDietaryRestrictionType = 'FORBIDDEN' | 'REDUCED';

export interface FindGroupByNameInput {
    name: string;
}

export interface FindMembersByRestrictionInput {
    groupId: string;
    restrictionType: TDietaryRestrictionType;
    reason?: string;
}

export interface GetGroupsSummaryInput {
    limit?: number;
    offset?: number;
}

export interface GetGroupRecipeContextInput {
    id: string;
    anonymize?: boolean;
}

// Tool output types
export interface GroupIdResolution {
    type: 'group-id-resolution';
    schemaVersion: 1;
    id: string;
    name: string;
}

export interface MemberBasicInfo {
    id: string;
    firstName: string;
    lastName: string;
}

export interface FindMembersByRestrictionOutput {
    groupId: string;
    groupName: string;
    restrictionType: TDietaryRestrictionType;
    reason?: string;
    matchingMembers: MemberBasicInfo[];
}

export interface GroupSummaryItem {
    id: string;
    name: string;
    membersCount: number;
}

export interface GroupsSummaryOutput {
    type: 'groups-summary';
    schemaVersion: 1;
    total: number;
    limit: number;
    offset: number;
    count: number;
    groups: GroupSummaryItem[];
}

export interface ToolResult<T> {
    content: Array<{ type: 'text'; text: string }>;
    structuredContent?: T;
    [key: string]: unknown;
}

export interface GroupInput {
    id: string;
    name: string;
    members: MemberInput[];
}

export interface MemberInput {
    id: string;
    firstName?: string;
    lastName?: string;
    age?: number;
    cookingSkill?: string;
    cuisinePreferences?: string[];
    dietaryProfile?: {
        preferences?: {
            likes?: string[];
            dislikes?: string[];
        };
        allergies?: Array<string | { name?: string; substance?: string }>;
        restrictions?: Array<string | {
            type?: string;
            category?: string;
            reason?: string;
            code?: string;
            name?: string;
        }>;
    };
}