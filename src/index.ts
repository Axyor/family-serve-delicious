import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from 'dotenv';
import { Database, EGender, EGroupRole, EDietaryRestriction } from '@family-serve/database';

config();

const server = new McpServer({
    name: "family-serve-delicious",
    version: "1.0.0"
});


const initializeDatabase = async () => {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI must be defined in environment variables');
    }

    return Database.initialize(process.env.MONGODB_URI);
};

let db: Database;


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

server.registerTool(
    "create-group",
    {
        title: "Create Group",
        description: "Create a new family or group",
        inputSchema: {
            name: z.string().describe("Name of the group")
        }
    },
    async ({ name }) => {
        const group = await db.getGroupService().createGroup(name);
        return {
            content: [{
                type: "text",
                text: `Created group "${name}" with ID: ${group._id}`
            }]
        };
    }
);


server.registerTool(
    "add-member",
    {
        title: "Add Member",
        description: "Add a new member to a group",
        inputSchema: {
            groupId: z.string(),
            firstName: z.string(),
            lastName: z.string(),
            age: z.number(),
            gender: z.enum([EGender.MALE, EGender.FEMALE]),
            role: z.enum([EGroupRole.ADMIN, EGroupRole.MEMBER]).optional(),
            restrictions: z.array(z.enum([
                EDietaryRestriction.VEGETARIAN,
                EDietaryRestriction.VEGAN,
                EDietaryRestriction.GLUTEN_FREE,
                EDietaryRestriction.DAIRY_FREE
            ])).optional(),
            allergies: z.array(z.string()).optional(),
            likes: z.array(z.string()).optional(),
            dislikes: z.array(z.string()).optional(),
            healthNotes: z.string().optional()
        }
    },
    async ({ groupId, firstName, lastName, age, gender, role, restrictions, allergies, likes, dislikes, healthNotes }) => {
        const member = await db.getGroupService().addMember(groupId, {
            firstName,
            lastName,
            age,
            gender,
            role: role || EGroupRole.MEMBER,
            dietaryProfile: {
                preferences: {
                    likes: likes || [],
                    dislikes: dislikes || []
                },
                allergies: allergies || [],
                restrictions: restrictions || [],
                healthNotes
            }
        });

        return {
            content: [{
                type: "text",
                text: `Added ${firstName} ${lastName} to group ${groupId}`
            }]
        };
    }
);
const start = async () => {
    try {

        db = await initializeDatabase();
        console.log('Successfully connected to MongoDB');

        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.log('MCP Server started successfully');
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
};

start();