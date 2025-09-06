import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDatabase } from '../db';

export const groupResourceHandler = async (uri: URL, variables: Record<string, unknown>) => {
    const groupId = variables.groupId as string;
    const group = await getDatabase().getGroupService().getGroup(groupId);
    if (!group) return { contents: [] } as any;
    return { contents: [{ uri: uri.href, text: JSON.stringify(group, null, 2) }] } as any;
};

export const groupResource = () => ({
    name: 'group',
    template: new ResourceTemplate('groups://{groupId}', { list: undefined }),
    meta: {
        title: 'Group Information',
        description: 'Access group information and members'
    },
    handler: groupResourceHandler
});
