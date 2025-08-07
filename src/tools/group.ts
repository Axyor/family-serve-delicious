import { z } from "zod";
import { Database, EGender, EGroupRole, EDietaryRestriction } from '../mockDatabase.js';
import { server } from "../server.js";

export const registerGroupTools = (db: Database) => {
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
};
