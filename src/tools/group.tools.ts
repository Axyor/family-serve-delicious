import { z } from 'zod';
import { getDatabase } from '../db.js';
import { EDietaryRestrictionType, EDietaryRestriction } from '@axyor/family-serve-database';

// --- Helpers -----------------------------------------------------------------
// Remove empty / null / undefined fields recursively to reduce token usage.
const prune = (value: any): any => {
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

const serializeMember = (m: any) => prune({
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

const structureGroup = (group: any, includeMembers = true) => prune({
    id: group.id,
    name: group.name,
    membersCount: group.members.length,
    members: includeMembers ? group.members.map(serializeMember) : undefined
});


export const findGroupByNameHandler = async (args: any) => {
    const { name } = args as { name: string };
    const group = await getDatabase().getGroupService().findByName(name);
    if (!group) return { content: [{ type: 'text' as const, text: `No group found for name: ${name}` }] } as any;
    const structured = {
        type: 'group-full',
        schemaVersion: 1,
        data: structureGroup(group, true)
    };
    return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }] } as any;
};
export const findGroupByNameTool = () => ({
    name: 'find-group-by-name',
    meta: { title: 'Find Group By Name', description: 'Lookup a single group by its name to get its id without listing all groups', inputSchema: { name: z.string() } },
    handler: findGroupByNameHandler
});


export const findMembersByRestrictionHandler = async (args: any) => {
    const { groupId, restrictionType, reason } = args as { groupId: string; restrictionType: EDietaryRestrictionType; reason?: EDietaryRestriction | string };
    const result = await getDatabase().getGroupService().findMembersByRestriction(groupId, restrictionType, reason);
    if (!result) return { content: [{ type: 'text' as const, text: 'Group not found or no matching members' }] } as any;
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] } as any;
};
export const findMembersByRestrictionTool = () => ({
    name: 'find-members-by-restriction',
    meta: { title: 'Find Members by Restriction', description: 'Filter members in a group by restriction type and optional reason', inputSchema: { groupId: z.string(), restrictionType: z.nativeEnum(EDietaryRestrictionType), reason: z.union([z.nativeEnum(EDietaryRestriction), z.string()]).optional() } },
    handler: findMembersByRestrictionHandler
});

export const getFullGroupHandler = async (args: any) => {
    const { id } = args as { id: string };
    const group = await getDatabase().getGroupService().getGroup(id);
    if (!group) return { content: [{ type: 'text' as const, text: `Group not found: ${id}` }] } as any;
    const structured = {
        type: 'group-full',
        schemaVersion: 1,
        data: structureGroup(group, true)
    };
    return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }] } as any;
};
export const getFullGroupTool = () => ({
    name: 'group-full',
    meta: { title: 'Get Full Group', description: 'Retrieve full group with members', inputSchema: { id: z.string() } },
    handler: getFullGroupHandler
});

// --- New: list all groups (paginated) ---------------------------------------
export const getAllFullGroupsHandler = async (args: any) => {
    const { limit = 20, offset = 0, includeMembers = false } = args as { limit?: number; offset?: number; includeMembers?: boolean };
    const service: any = getDatabase().getGroupService();
    // Try a few possible method names defensively.
    let groups: any[] | undefined;
    if (typeof service.listGroups === 'function') groups = await service.listGroups();
    else if (typeof service.getAllGroups === 'function') groups = await service.getAllGroups();
    else if (typeof service.getGroups === 'function') groups = await service.getGroups();
    if (!groups) {
        return { content: [{ type: 'text' as const, text: 'Listing groups not supported by current GroupService' }] } as any;
    }
    const total = groups.length;
    const slice = groups.slice(offset, offset + limit).map(g => structureGroup(g, includeMembers));
    const payload = { type: 'groups-full', schemaVersion: 1, total, limit, offset, count: slice.length, includeMembers, groups: slice };
    return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] } as any;
};
export const getAllFullGroupsTool = () => ({
    name: 'groups-full',
    meta: { title: 'List All Groups (Full)', description: 'List groups (optionally include full member detail) paginated', inputSchema: { limit: z.number().int().positive().max(100).optional(), offset: z.number().int().min(0).optional(), includeMembers: z.boolean().optional() } },
    handler: getAllFullGroupsHandler
});

// Summary only (always no members, minimal fields)
export const getGroupsSummaryHandler = async (args: any) => {
    const { limit = 20, offset = 0 } = args as { limit?: number; offset?: number };
    const service: any = getDatabase().getGroupService();
    let groups: any[] | undefined;
    if (typeof service.listGroups === 'function') groups = await service.listGroups();
    else if (typeof service.getAllGroups === 'function') groups = await service.getAllGroups();
    else if (typeof service.getGroups === 'function') groups = await service.getGroups();
    if (!groups) return { content: [{ type: 'text' as const, text: 'Listing groups not supported by current GroupService' }] } as any;
    const total = groups.length;
    const slice = groups.slice(offset, offset + limit).map((g: any) => ({ id: g.id, name: g.name, membersCount: g.members.length }));
    const payload = { type: 'groups-summary', schemaVersion: 1, total, limit, offset, count: slice.length, groups: slice };
    return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] } as any;
};
export const getGroupsSummaryTool = () => ({
    name: 'groups-summary',
    meta: { title: 'List Groups (Summary)', description: 'Lightweight summary list of groups (no members)', inputSchema: { limit: z.number().int().positive().max(100).optional(), offset: z.number().int().min(0).optional() } },
    handler: getGroupsSummaryHandler
});

export const allGroupTools = () => [findGroupByNameTool(), getFullGroupTool(), getAllFullGroupsTool(), getGroupsSummaryTool(), findMembersByRestrictionTool()];
