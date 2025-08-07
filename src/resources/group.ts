import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Database } from "../mockDatabase.js";
import { server } from "../server.js";

export const registerGroupResource = (db: Database) => {
    server.registerResource(
        "group",
        new ResourceTemplate("groups://{groupId}", { list: undefined }),
        {
            title: "Group Information",
            description: "Access group information and members"
        },
        async (uri, variables) => {
            const groupId = variables.groupId as string;
            const group = await db.getGroupService().getGroup(groupId);

            if (!group) {
                return { contents: [] };
            }

            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify(group, null, 2)
                }]
            };
        }
    );
};
