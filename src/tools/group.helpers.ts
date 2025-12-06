import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { IAllergyAgg, IGroupRecipeContext, Counters, GroupInput, MemberInput } from '../interfaces';

const prune = <T>(value: T): T | undefined => {
    if (Array.isArray(value)) {
        const arr = value.map(v => prune(v)).filter(v => v !== undefined);
        return (arr.length ? arr : undefined) as T | undefined;
    }
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            const pv = prune(v);
            if (pv !== undefined && !(Array.isArray(pv) && pv.length === 0)) out[k] = pv;
        }
        return (Object.keys(out).length ? out : undefined) as T | undefined;
    }
    if (value === null || value === undefined || value === '') return undefined;
    return value;
};

const ageGroup = (age?: number) => {
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

function createAllergenSynonymIndex() {
    return new AllergenSynonymIndex();
}

const allergenIndex = createAllergenSynonymIndex();

const normalizeAllergen = (raw: string): string => {
    if (!raw) return '';
    const cleaned = raw.trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return allergenIndex.getCanonical(cleaned) || cleaned;
};



export const buildRecipeContext = (group: GroupInput, anonymize = true): IGroupRecipeContext => {
    const members = group.members || [];
    const memberContexts = members.map((m: MemberInput, idx: number) => {
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


    const processCuisinePreferences = (member: MemberInput, cuisinesLikedSet: Set<string>) => {

        if (Array.isArray(member.cuisinePreferences)) {
            for (const cuisine of member.cuisinePreferences) {
                if (typeof cuisine === 'string' && cuisine.trim()) {
                    cuisinesLikedSet.add(cuisine.trim().toLowerCase());
                }
            }
        }

        const preferences = member.dietaryProfile?.preferences;
        if (preferences && typeof preferences === 'object' && !Array.isArray(preferences)) {
            const likes = preferences.likes || [];
            if (Array.isArray(likes)) {
                likes.forEach((item: string) => {
                    if (typeof item === 'string' && item.trim()) {
                        cuisinesLikedSet.add(item.trim().toLowerCase());
                    }
                });
            }
        }
    };

    const processPreferences = (member: MemberInput, dislikesSet: Set<string>) => {
        const preferences = member.dietaryProfile?.preferences;
        if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return;

        const dislikes = preferences.dislikes || [];
        if (Array.isArray(dislikes)) {
            dislikes.forEach((item: string) => {
                if (typeof item === 'string' && item.trim()) {
                    dislikesSet.add(item.trim().toLowerCase());
                }
            });
        }
    };

    const processAllergies = (member: MemberInput, allergyMap: Record<string, Set<string>>) => {
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

    const processRestrictions = (member: MemberInput, hardRestrictionSet: Set<string>, softRestrictionSet: Set<string>) => {
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
    members.forEach((member: MemberInput) => {
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
