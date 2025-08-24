// Shared interfaces for group tools & helpers

export interface IAllergyAgg { substance: string; members: string[]; count: number; }
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

// Ensure this file is treated as a module for NodeNext resolution
export { };
