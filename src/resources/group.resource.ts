import { ResourceTemplate, ResourceMetadata, ReadResourceTemplateCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDatabase } from '../db';
import { ResourceResult } from '../interfaces';

export const groupResourceHandler: ReadResourceTemplateCallback = async (uri, variables): Promise<ResourceResult> => {
    const groupId = variables.groupId as string;
    const group = await getDatabase().getGroupService().getGroup(groupId);
    if (!group) return { contents: [] };
    return { contents: [{ uri: uri.href, text: JSON.stringify(group, null, 2) }] };
};

export const groupResource = (): {
    name: string;
    template: ResourceTemplate;
    meta: ResourceMetadata;
    handler: ReadResourceTemplateCallback;
} => ({
    name: 'group',
    template: new ResourceTemplate('groups://{groupId}', { list: undefined }),
    meta: {
        title: 'Group Information',
        description: 'Access group information and members'
    },
    handler: groupResourceHandler
});
