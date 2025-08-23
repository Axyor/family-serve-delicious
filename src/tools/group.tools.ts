import { z } from 'zod';
import { getDatabase } from '../db.js';
import { EDietaryRestrictionType, EDietaryRestriction } from '@axyor/family-serve-database';


export const findGroupByNameHandler = async (args: any) => {
    const { name } = args as { name: string };
    const group = await getDatabase().getGroupService().findByName(name);
    if (!group) return { content: [{ type: 'text' as const, text: `No group found for name: ${name}` }] } as any;
    const summary = { id: group.id, name: group.name, membersCount: group.members.length };
    return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] } as any;
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
    return { content: [{ type: 'text' as const, text: JSON.stringify(group, null, 2) }] } as any;
};
export const getFullGroupTool = () => ({
    name: 'group-full',
    meta: { title: 'Get Full Group', description: 'Retrieve full group with members', inputSchema: { id: z.string() } },
    handler: getFullGroupHandler
});

export const allGroupTools = () => [findGroupByNameTool(), getFullGroupTool(), findMembersByRestrictionTool()];
