import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EDietaryRestrictionType } from '@axyor/family-serve-database';
import { IAllergyAgg, IPrefPatterns, IGroupRecipeContext, IGroupRecipeContextMember } from './group.interfaces.js';

// -------------------- Generic Helper: prune ---------------------------------
export const prune = (value: any): any => {
    if (Array.isArray(value)) {
        const arr = value.map(v => prune(v)).filter(v => v !== undefined);
        return arr.length ? arr : undefined;
    }
    if (value && typeof value === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(value)) {
            const pv = prune(v);
            if (pv !== undefined && !(Array.isArray(pv) && pv.length === 0)) out[k] = pv;
        }
        return Object.keys(out).length ? out : undefined;
    }
    if (value === null || value === undefined || value === '') return undefined;
    return value;
};

// -------------------- Member serialization (generic) ------------------------
export const serializeMember = (m: any) => prune({
    id: m.id,
    role: m.role,
    firstName: m.firstName,
    lastName: m.lastName,
    age: m.age,
    gender: m.gender,
    metrics: prune({
        weightKg: m.weightKg,
        heightCm: m.heightCm,
        activityLevel: m.activityLevel
    }),
    healthGoals: m.healthGoals,
    nutritionTargets: m.nutritionTargets,
    dietaryProfile: prune({
        preferences: m.dietaryProfile?.preferences,
        allergies: m.dietaryProfile?.allergies,
        restrictions: m.dietaryProfile?.restrictions,
        healthNotes: m.dietaryProfile?.healthNotes
    }),
    cuisinePreferences: m.cuisinePreferences,
    budgetLevel: m.budgetLevel,
    cookingSkill: m.cookingSkill,
    mealFrequency: m.mealFrequency,
    fastingWindow: m.fastingWindow
});

export const structureGroup = (group: any, includeMembers = true) => prune({
    id: group.id,
    name: group.name,
    membersCount: group.members.length,
    members: includeMembers ? group.members.map(serializeMember) : undefined
});

// -------------------- Age grouping ------------------------------------------
export const ageGroup = (age?: number) => {
    if (age == null) return undefined;
    if (age < 13) return 'child';
    if (age < 18) return 'teen';
    if (age < 60) return 'adult';
    return 'senior';
};

// -------------------- Internal loaders --------------------------------------
let allergenSynonyms: Record<string, string[]> | null = null;
let prefPatterns: IPrefPatterns | null = null;
const allergenSynonymIndex: { built?: boolean; map: Record<string, string> } = { map: {} };

const loadAllergenSynonyms = () => {
    if (allergenSynonyms) return allergenSynonyms;
    try {
        const filePath = path.resolve(process.cwd(), 'config/allergen-synonyms.json');
        allergenSynonyms = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        allergenSynonyms = {};
    }
    return allergenSynonyms;
};

const ensureAllergenIndex = () => {
    if (allergenSynonymIndex.built) return;
    const syns = loadAllergenSynonyms() || {};
    for (const [canonical, list] of Object.entries(syns as Record<string, string[]>)) {
        const canonKey = canonical.toLowerCase();
        const arr = Array.isArray(list) ? list : [];
        const all = new Set<string>([canonical, ...arr]);
        for (const term of all) {
            const norm = term.trim().toLowerCase();
            if (!norm) continue;
            allergenSynonymIndex.map[norm] = canonKey;
        }
    }
    allergenSynonymIndex.built = true;
};

const normalizeAllergen = (raw: string): string => {
    if (!raw) return '';
    ensureAllergenIndex();
    const cleaned = raw.trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return allergenSynonymIndex.map[cleaned] || cleaned;
};

const loadPrefPatterns = () => {
    if (prefPatterns) return prefPatterns;
    try {
        const file = path.resolve(process.cwd(), 'config/preference-patterns.json');
        prefPatterns = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
        prefPatterns = {};
    }
    return prefPatterns;
};

// -------------------- Recipe context builder --------------------------------
export const buildRecipeContext = (group: any, anonymize = true): IGroupRecipeContext => {
    const members = group.members || [];
    const memberContexts = members.map((m: any, idx: number) => {
        const ag = ageGroup(m.age);
        const alias = `M${idx + 1}`;
        return anonymize ? { id: m.id, alias, ageGroup: ag } : { id: m.id, firstName: m.firstName, lastName: m.lastName, ageGroup: ag };
    });

    const ageGroupsCount: Record<string, number> = {};
    for (const mc of memberContexts) {
        if (mc.ageGroup) ageGroupsCount[mc.ageGroup] = (ageGroupsCount[mc.ageGroup] || 0) + 1;
    }

    interface Counters { [k: string]: number }
    const allergyMap: Record<string, Set<string>> = {};
    const hardRestrictionSet: Set<string> = new Set();
    const softRestrictionSet: Set<string> = new Set();
    const cuisinesLikedSet: Set<string> = new Set();
    const dislikesSet: Set<string> = new Set();

    // Preference patterns
    const patterns = loadPrefPatterns() || {};
    const normList = (arr?: string[]) => Array.isArray(arr) ? Array.from(new Set(arr.map(s => s.toLowerCase().trim()).filter(Boolean))).sort((a, b) => b.length - a.length) : [];
    const dislikeIndicators = normList(patterns.dislikeIndicators);
    const avoidIndicators = normList(patterns.avoidIndicators);
    const excludeIndicators = normList(patterns.excludeIndicators);
    const splitRegex = new RegExp(patterns.splitDelimitersRegex || ',|;');
    const extractNegativeTokens = (text: string) => {
        const raw = text.trim();
        if (!raw) return [] as string[];
        const lower = raw.toLowerCase();
        const indicators = [...dislikeIndicators, ...avoidIndicators];
        for (const ind of indicators) {
            if (lower.startsWith(ind + ' ')) {
                const rest = lower.slice(ind.length).trim();
                return rest.split(splitRegex).map(t => t.trim()).filter(Boolean);
            }
        }
        for (const ex of excludeIndicators) {
            if (lower.startsWith(ex + ' ')) {
                const rest = lower.slice(ex.length).trim();
                return rest.split(splitRegex).map(t => t.trim()).filter(Boolean);
            }
        }
        return [];
    };

    for (const m of members) {
        const dp = m.dietaryProfile || {};
        if (Array.isArray(m.cuisinePreferences)) {
            for (const c of m.cuisinePreferences) if (typeof c === 'string' && c.trim()) cuisinesLikedSet.add(c.trim().toLowerCase());
        }
        if (Array.isArray(dp.preferences)) {
            for (const p of dp.preferences) if (typeof p === 'string') extractNegativeTokens(p).forEach(t => dislikesSet.add(t));
        }
        if (Array.isArray(dp.allergies)) {
            for (const a of dp.allergies) {
                const name = typeof a === 'string' ? a : (a?.name ?? a?.substance);
                if (!name) continue;
                const key = normalizeAllergen(String(name));
                if (!key) continue;
                if (!allergyMap[key]) allergyMap[key] = new Set();
                allergyMap[key].add(m.id);
            }
        }
        if (Array.isArray(dp.restrictions)) {
            for (const r of dp.restrictions) {
                if (r == null) continue;
                if (typeof r === 'string') {
                    hardRestrictionSet.add(r);
                } else {
                    const type = r.type || r.category;
                    const reason = r.reason || r.code || r.name;
                    if (reason) {
                        if (type === EDietaryRestrictionType.FORBIDDEN) hardRestrictionSet.add(reason);
                        else if (type === EDietaryRestrictionType.REDUCED) softRestrictionSet.add(reason);
                    }
                }
            }
        }
    }

    const allergies: IAllergyAgg[] = Object.entries(allergyMap)
        .map(([k, set]) => ({ substance: k, members: Array.from(set), count: set.size }))
        .sort((a, b) => b.count - a.count || a.substance.localeCompare(b.substance));

    const hardRestrictions = Array.from(hardRestrictionSet).sort();
    const softRestrictions = Array.from(softRestrictionSet).sort();
    const softPreferences = prune({
        cuisinesLiked: Array.from(cuisinesLikedSet).sort(),
        dislikes: Array.from(dislikesSet).sort()
    });

    const cookingSkillSpread: Counters = {};
    for (const m of members) if (m.cookingSkill) cookingSkillSpread[m.cookingSkill] = (cookingSkillSpread[m.cookingSkill] || 0) + 1;

    const payload: IGroupRecipeContext = {
        type: 'group-recipe-context',
        schemaVersion: 1,
        group: { id: group.id, name: group.name, size: members.length },
        members: memberContexts,
        segments: { ageGroups: ageGroupsCount },
        allergies,
        hardRestrictions,
        softRestrictions,
        softPreferences,
        stats: { cookingSkillSpread },
        hash: ''
    };
    const hash = crypto.createHash('sha256').update(JSON.stringify({ ...payload, hash: undefined })).digest('hex');
    payload.hash = `sha256:${hash.slice(0, 16)}`;
    return payload;
};
