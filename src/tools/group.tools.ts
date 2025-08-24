import { z } from 'zod';
import { getDatabase } from '../db.js';
import { EDietaryRestriction, EDietaryRestrictionType } from '@axyor/family-serve-database';
import { buildRecipeContext, structureGroup, prune } from './group.helpers.js';


export const findGroupByNameHandler = async (args: any) => {
    const { name } = args as { name: string };
    const group = await getDatabase().getGroupService().findByName(name);
    if (!group) return { content: [{ type: 'text' as const, text: `No group found for name: ${name}` }] } as any;
    const structured = {
        // Recipe context building moved to helpers (buildRecipeContext)
        type: 'group-id-resolution',
        schemaVersion: 1,
        id: group.id,
        name: group.name
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

// Recipe context building moved to helpers (buildRecipeContext)

export const getGroupRecipeContextHandler = async (args: any) => {
    const { id, anonymize = true } = args as { id: string; anonymize?: boolean };
    const group = await getDatabase().getGroupService().getGroup(id);
    if (!group) return { content: [{ type: 'text' as const, text: `Group not found: ${id}` }] } as any;
    const context = buildRecipeContext(group, anonymize);
    return { content: [{ type: 'text' as const, text: JSON.stringify(context) }] } as any;
};
export const getGroupRecipeContextTool = () => ({
    name: 'group-recipe-context',
    meta: { title: 'Group Recipe Context', description: 'Aggregated, anonymized context for recipe generation', inputSchema: { id: z.string(), anonymize: z.boolean().optional() } },
    handler: getGroupRecipeContextHandler
});

export const allGroupTools = () => [findGroupByNameTool(), getGroupsSummaryTool(), findMembersByRestrictionTool(), getGroupRecipeContextTool()];
