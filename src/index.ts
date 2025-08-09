import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from 'dotenv';
import {
    Database,
    EGender,
    EGroupRole,
    EDietaryRestriction,
    EDietaryRestrictionType
} from '@axyor/family-serve-database';

config();

export const server = new McpServer({
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
export const setDatabase = (database: Database) => {
    db = database;
};


export const groupResourceHandler = async (uri: URL, variables: Record<string, unknown>) => {
    const groupId = variables.groupId as string;
    const group = await db.getGroupService().getGroup(groupId);

    if (!group) {
        return { contents: [] } as any;
    }

    return {
        contents: [{
            uri: uri.href,
            text: JSON.stringify(group, null, 2)
        }]
    } as any;
};

server.registerResource(
    "group",
    new ResourceTemplate("groups://{groupId}", { list: undefined }),
    {
        title: "Group Information",
        description: "Access group information and members"
    },
    groupResourceHandler
);

export const createGroupHandler = async ({ name }: { name: string }) => {
    const group = await db.getGroupService().createGroup(name);
    return {
        content: [{
        type: "text" as const,
            text: `Created group "${name}" with ID: ${group.id ?? '[unknown]'}`
        }]
    } as any;
};

server.registerTool(
    "create-group",
    {
        title: "Create Group",
        description: "Create a new family or group",
        inputSchema: {
            name: z.string().describe("Name of the group")
        }
    },
    createGroupHandler
);


export const addMemberHandler = async ({ groupId, firstName, lastName, age, gender, role, restrictions, allergies, likes, dislikes, healthNotes }: {
    groupId: string,
    firstName: string,
    lastName: string,
    age: number,
    gender: EGender,
    role?: EGroupRole,
    restrictions?: Array<{ type: EDietaryRestrictionType, reason: EDietaryRestriction | string, notes?: string }>,
    allergies?: string[],
    likes?: string[],
    dislikes?: string[],
    healthNotes?: string
}) => {
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
        type: "text" as const,
            text: `Added ${firstName} ${lastName} to group ${groupId}`
        }]
    } as any;
};

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
            gender: z.nativeEnum(EGender),
            role: z.nativeEnum(EGroupRole).optional(),
            restrictions: z.array(z.object({
                type: z.nativeEnum(EDietaryRestrictionType),
                reason: z.union([z.nativeEnum(EDietaryRestriction), z.string()]),
                notes: z.string().optional()
            })).optional(),
            allergies: z.array(z.string()).optional(),
            likes: z.array(z.string()).optional(),
            dislikes: z.array(z.string()).optional(),
            healthNotes: z.string().optional()
        }
    },
    addMemberHandler
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

// Graceful shutdown on SIGINT
process.on('SIGINT', async () => {
    try {
        if (db) {
            await db.disconnect();
            console.log('Disconnected from MongoDB');
        }
    } catch (e) {
        console.error('Error during shutdown:', e);
    } finally {
        process.exit(0);
    }
});

if (process.env.NODE_ENV !== 'test') {
    start();
}

export { start };