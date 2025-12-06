import { z } from 'zod';
import { getDatabase } from '../db';
import { buildRecipeContext } from './group.helpers';
import { 
    TDietaryRestrictionType, 
    IGroupRecipeContext,
    FindGroupByNameInput,
    FindMembersByRestrictionInput,
    GetGroupsSummaryInput,
    GetGroupRecipeContextInput,
    GroupIdResolution,
    FindMembersByRestrictionOutput,
    GroupsSummaryOutput,
    GroupSummaryItem,
    ToolResult
} from '../interfaces';
import { InputSanitizer } from '../security/sanitization';

const findGroupByNameHandler = async (args: FindGroupByNameInput): Promise<ToolResult<GroupIdResolution>> => {

    const sanitized = InputSanitizer.sanitizeObject(args);
    const { name } = sanitized as FindGroupByNameInput;
    const group = await getDatabase().getGroupService().findByName(name);
    if (!group) return { content: [{ type: 'text' as const, text: `No group found for name: ${name}` }] };
    const structured: GroupIdResolution = {
        type: 'group-id-resolution',
        schemaVersion: 1,
        id: group.id,
        name: group.name
    };
    return { 
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured
    };
};
export const findGroupByNameTool = () => ({
    name: 'find-group-by-name',
    meta: { 
        title: 'Find Group By Name', 
        description: 'Lookup a single group by its name to get its id without listing all groups', 
        inputSchema: { name: z.string() },
        outputSchema: {
            type: z.literal('group-id-resolution'),
            schemaVersion: z.literal(1),
            id: z.string(),
            name: z.string()
        }
    },
    handler: findGroupByNameHandler
});

const findMembersByRestrictionHandler = async (args: FindMembersByRestrictionInput): Promise<ToolResult<FindMembersByRestrictionOutput>> => {

    const sanitized = InputSanitizer.sanitizeObject(args);
    const { groupId, restrictionType, reason } = sanitized as FindMembersByRestrictionInput;
    const result = await getDatabase().getGroupService().findMembersByRestriction(groupId, restrictionType, reason);
    if (!result) return { content: [{ type: 'text' as const, text: 'Group not found or no matching members' }] };
    return { 
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as FindMembersByRestrictionOutput
    };
};
export const findMembersByRestrictionTool = () => ({
    name: 'find-members-by-restriction',
    meta: { 
        title: 'Find Members by Restriction', 
        description: 'Filter members in a group by restriction type and optional reason', 
        inputSchema: { 
            groupId: z.string(), 
            restrictionType: z.enum(['FORBIDDEN', 'REDUCED']), 
            reason: z.string().optional() 
        },
        outputSchema: {
            groupId: z.string(),
            groupName: z.string(),
            restrictionType: z.enum(['FORBIDDEN', 'REDUCED']),
            reason: z.string().optional(),
            matchingMembers: z.array(z.object({
                id: z.string(),
                firstName: z.string(),
                lastName: z.string()
            }))
        }
    },
    handler: findMembersByRestrictionHandler
});


const getGroupsSummaryHandler = async (args: GetGroupsSummaryInput): Promise<ToolResult<GroupsSummaryOutput>> => {

    const sanitized = InputSanitizer.sanitizeObject(args);
    const { limit = 20, offset = 0 } = sanitized as GetGroupsSummaryInput;
    const groups = await getDatabase().getGroupService().listGroups();
    const total = groups.length;
    const slice = groups.slice(offset, offset + limit).map((g: { id: string; name: string; members: unknown[] }): GroupSummaryItem => ({ id: g.id, name: g.name, membersCount: g.members.length }));
    const payload: GroupsSummaryOutput = { type: 'groups-summary', schemaVersion: 1, total, limit, offset, count: slice.length, groups: slice };
    return { 
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
        structuredContent: payload
    };
};
export const getGroupsSummaryTool = () => ({
    name: 'groups-summary',
    meta: { 
        title: 'List Groups (Summary)', 
        description: 'Lightweight summary list of groups (no members)', 
        inputSchema: { 
            limit: z.number().int().positive().max(100).optional(), 
            offset: z.number().int().min(0).optional() 
        },
        outputSchema: {
            type: z.literal('groups-summary'),
            schemaVersion: z.literal(1),
            total: z.number().int().min(0),
            limit: z.number().int().positive(),
            offset: z.number().int().min(0),
            count: z.number().int().min(0),
            groups: z.array(z.object({
                id: z.string(),
                name: z.string(),
                membersCount: z.number().int().min(0)
            }))
        }
    },
    handler: getGroupsSummaryHandler
});

const getGroupRecipeContextHandler = async (args: GetGroupRecipeContextInput): Promise<ToolResult<IGroupRecipeContext>> => {

    const sanitized = InputSanitizer.sanitizeObject(args) as GetGroupRecipeContextInput;
    const { id } = sanitized;
    const allowRaw = process.env.ALLOW_RAW_CONTEXT === 'true';
    const anonymize = allowRaw ? (sanitized.anonymize ?? true) : true;
    const group = await getDatabase().getGroupService().getGroup(id);
    if (!group) return { content: [{ type: 'text' as const, text: `Group not found: ${id}` }] };
    const context = buildRecipeContext(group, anonymize);
    return { 
        content: [{ type: 'text' as const, text: JSON.stringify(context) }],
        structuredContent: context
    };
};
export const getGroupRecipeContextTool = () => ({
    name: 'group-recipe-context',
    meta: { 
        title: 'Group Recipe Context', 
        description: 'Aggregated, anonymized context for recipe generation', 
        inputSchema: { 
            id: z.string(), 
            anonymize: z.boolean().optional() 
        },
        outputSchema: {
            type: z.literal('group-recipe-context'),
            schemaVersion: z.literal(1),
            group: z.object({
                id: z.string(),
                name: z.string(),
                size: z.number().int().min(0)
            }),
            members: z.array(z.object({
                id: z.string(),
                alias: z.string().optional(),
                firstName: z.string().optional(),
                lastName: z.string().optional(),
                ageGroup: z.string().optional()
            })),
            segments: z.object({
                ageGroups: z.record(z.string(), z.number().int().min(0))
            }),
            allergies: z.array(z.object({
                substance: z.string(),
                members: z.array(z.string()),
                count: z.number().int().positive()
            })),
            hardRestrictions: z.array(z.string()),
            softRestrictions: z.array(z.string()),
            softPreferences: z.object({
                cuisinesLiked: z.array(z.string()).optional(),
                dislikes: z.array(z.string()).optional()
            }).optional(),
            stats: z.object({
                cookingSkillSpread: z.record(z.string(), z.number().int().min(0))
            }),
            hash: z.string()
        }
    },
    handler: getGroupRecipeContextHandler
});

export const allGroupTools = () => [findGroupByNameTool(), getGroupsSummaryTool(), findMembersByRestrictionTool(), getGroupRecipeContextTool()];
