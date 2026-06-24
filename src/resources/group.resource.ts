import { ResourceTemplate, ResourceMetadata, ReadResourceTemplateCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getDatabase } from '../db';
import { ResourceResult } from '../interfaces';

export const groupResourceHandler: ReadResourceTemplateCallback = async (uri, variables): Promise<ResourceResult> => {
    const groupId = variables.groupId as string;
    const group = await getDatabase().getGroupService().getGroup(groupId);
    if (!group) throw new McpError(ErrorCode.InvalidParams, `Group not found: ${groupId}`);
    return { contents: [{ uri: uri.href, text: JSON.stringify(group, null, 2) }] };
};

export const groupResourceList = async () => {
    const groups = await getDatabase().getGroupService().listGroups();
    return {
        resources: groups.map((g: { id: string; name: string; members: unknown[] }) => ({
            uri: `groups://${g.id}`,
            name: g.name,
            description: `${g.members.length} member(s)`
        }))
    };
};

export const groupResource = (): {
    name: string;
    template: ResourceTemplate;
    meta: ResourceMetadata;
    handler: ReadResourceTemplateCallback;
} => ({
    name: 'group',
    template: new ResourceTemplate('groups://{groupId}', { list: groupResourceList }),
    meta: {
        title: 'Group Information',
        description: 'Access group information and members'
    },
    handler: groupResourceHandler
});
