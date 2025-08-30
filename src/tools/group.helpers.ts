import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { IAllergyAgg, IPrefPatterns, IGroupRecipeContext, Counters } from './group.interfaces';

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

export const ageGroup = (age?: number) => {
    if (age == null) return undefined;
    if (age < 13) return 'child';
    if (age < 18) return 'teen';
    if (age < 60) return 'adult';
    return 'senior';
};

class AllergenSynonymIndex {
    private built: boolean = false;
    private map: Record<string, string> = {};
    private allergenSynonyms: Record<string, string[]> | null = null;

    private loadAllergenSynonyms(): Record<string, string[]> {
        if (this.allergenSynonyms) return this.allergenSynonyms;
        try {
            const filePath = path.resolve(process.cwd(), 'config/allergen-synonyms.json');
            this.allergenSynonyms = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (error) {
            console.error('Error loading allergen synonyms:', error);
            this.allergenSynonyms = {};
        }
        return this.allergenSynonyms!;
    }

    public ensureIndex() {
        if (this.built) return;
        const syns = this.loadAllergenSynonyms() || {};
        for (const [canonical, list] of Object.entries(syns as Record<string, string[]>)) {
            const canonKey = canonical.toLowerCase();
            const arr = Array.isArray(list) ? list : [];
            const all = new Set<string>([canonical, ...arr]);
            for (const term of all) {
                const norm = term.trim().toLowerCase();
                if (!norm) continue;
                this.map[norm] = canonKey;
            }
        }
        this.built = true;
    }

    public getCanonical(term: string): string | undefined {
        this.ensureIndex();
        return this.map[term.trim().toLowerCase()];
    }

    public getMap(): Record<string, string> {
        this.ensureIndex();
        return { ...this.map };
    }
}

export function createAllergenSynonymIndex() {
    return new AllergenSynonymIndex();
}

const allergenIndex = createAllergenSynonymIndex();

const normalizeAllergen = (raw: string): string => {
    if (!raw) return '';
    const cleaned = raw.trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return allergenIndex.getCanonical(cleaned) || cleaned;
};

let prefPatterns: IPrefPatterns | null = null;

// Cache for compiled regex to avoid recompilation
let cachedSplitRegex: RegExp | null = null;
let cachedSplitPattern: string | null = null;

const getSplitRegex = (pattern?: string): RegExp => {
    const regexPattern = pattern || ',|;';
    if (cachedSplitPattern === regexPattern && cachedSplitRegex) {
        return cachedSplitRegex;
    }
    cachedSplitPattern = regexPattern;
    cachedSplitRegex = new RegExp(regexPattern);
    return cachedSplitRegex;
};

const loadPrefPatterns = () => {
    if (prefPatterns) return prefPatterns;
    try {
        const file = path.resolve(process.cwd(), 'config/preference-patterns.json');
        prefPatterns = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (error) {
        console.error('Error loading preference patterns configuration:', error);
        prefPatterns = {};
    }
    return prefPatterns;
};

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

    const allergyMap: Record<string, Set<string>> = {};
    const hardRestrictionSet: Set<string> = new Set();
    const softRestrictionSet: Set<string> = new Set();
    const cuisinesLikedSet: Set<string> = new Set();
    const dislikesSet: Set<string> = new Set();
    const patterns = loadPrefPatterns() || {};
    
    // Simplify list normalization - extract to helper
    const normalizeStringList = (arr?: string[]): string[] => {
        if (!Array.isArray(arr)) return [];
        return Array.from(new Set(
            arr.map(s => s.toLowerCase().trim())
               .filter(Boolean)
        )).sort((a, b) => b.length - a.length);
    };
    
    const dislikeIndicators = normalizeStringList(patterns.dislikeIndicators);
    const avoidIndicators = normalizeStringList(patterns.avoidIndicators);
    const excludeIndicators = normalizeStringList(patterns.excludeIndicators);
    const splitRegex = getSplitRegex(patterns.splitDelimitersRegex);

    const extractNegativeTokens = (text: string): string[] => {
        const raw = text.trim();
        if (!raw) return [];
        
        const lower = raw.toLowerCase();
        const allIndicators = [...dislikeIndicators, ...avoidIndicators, ...excludeIndicators];
        
        for (const indicator of allIndicators) {
            if (lower.startsWith(indicator + ' ')) {
                const rest = lower.slice(indicator.length).trim();
                return rest.split(splitRegex).map(t => t.trim()).filter(Boolean);
            }
        }
        return [];
    };

    // Helper functions for member processing
    const processCuisinePreferences = (member: any, cuisinesLikedSet: Set<string>) => {
        if (!Array.isArray(member.cuisinePreferences)) return;
        for (const cuisine of member.cuisinePreferences) {
            if (typeof cuisine === 'string' && cuisine.trim()) {
                cuisinesLikedSet.add(cuisine.trim().toLowerCase());
            }
        }
    };

    const processPreferences = (member: any, dislikesSet: Set<string>) => {
        const preferences = member.dietaryProfile?.preferences;
        if (!Array.isArray(preferences)) return;
        for (const preference of preferences) {
            if (typeof preference === 'string') {
                extractNegativeTokens(preference).forEach(token => dislikesSet.add(token));
            }
        }
    };

    const processAllergies = (member: any, allergyMap: Record<string, Set<string>>) => {
        const allergies = member.dietaryProfile?.allergies;
        if (!Array.isArray(allergies)) return;
        
        for (const allergy of allergies) {
            const name = typeof allergy === 'string' ? allergy : (allergy?.name ?? allergy?.substance);
            if (!name) continue;
            
            const key = normalizeAllergen(String(name));
            if (!key) continue;
            
            if (!allergyMap[key]) allergyMap[key] = new Set();
            allergyMap[key].add(member.id);
        }
    };

    const processRestrictions = (member: any, hardRestrictionSet: Set<string>, softRestrictionSet: Set<string>) => {
        const restrictions = member.dietaryProfile?.restrictions;
        if (!Array.isArray(restrictions)) return;
        
        for (const restriction of restrictions) {
            if (restriction == null) continue;
            
            if (typeof restriction === 'string') {
                hardRestrictionSet.add(restriction);
                continue;
            }
            
            const type = restriction.type || restriction.category;
            const reason = restriction.reason || restriction.code || restriction.name;
            if (!reason) continue;
            
            const typeUpper = String(type).toUpperCase();
            if (typeUpper === 'FORBIDDEN') {
                hardRestrictionSet.add(reason);
            } else if (typeUpper === 'REDUCED') {
                softRestrictionSet.add(reason);
            }
        }
    };

    // Process all members
    for (const member of members) {
        processCuisinePreferences(member, cuisinesLikedSet);
        processPreferences(member, dislikesSet);
        processAllergies(member, allergyMap);
        processRestrictions(member, hardRestrictionSet, softRestrictionSet);
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
    members.forEach((member: any) => {
        if (member.cookingSkill) {
            cookingSkillSpread[member.cookingSkill] = (cookingSkillSpread[member.cookingSkill] || 0) + 1;
        }
    });

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
