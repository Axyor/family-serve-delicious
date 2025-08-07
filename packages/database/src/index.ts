// Enums
export enum EGender {
    MALE = 'male',
    FEMALE = 'female',
}

export enum EGroupRole {
    ADMIN = 'admin',
    MEMBER = 'member',
}

export enum EDietaryRestriction {
    VEGETARIAN = 'vegetarian',
    VEGAN = 'vegan',
    GLUTEN_FREE = 'gluten-free',
    DAIRY_FREE = 'dairy-free',
}

// Interfaces for data structures
interface Member {
    _id: string;
    firstName: string;
    lastName:string;
    age: number;
    gender: EGender;
    role: EGroupRole;
    dietaryProfile: {
        preferences: {
            likes: string[];
            dislikes: string[];
        };
        allergies: string[];
        restrictions: EDietaryRestriction[];
        healthNotes?: string;
    };
}

interface Group {
    _id: string;
    name: string;
    members: Member[];
}

// In-memory store
const groups: Group[] = [];
let nextGroupId = 1;
let nextMemberId = 1;

class GroupService {
    async getGroup(groupId: string): Promise<Group | undefined> {
        return groups.find(g => g._id === groupId);
    }

    async createGroup(name: string): Promise<Group> {
        const newGroup: Group = {
            _id: (nextGroupId++).toString(),
            name,
            members: [],
        };
        groups.push(newGroup);
        return newGroup;
    }

    async addMember(groupId: string, memberData: Omit<Member, '_id'>): Promise<Member> {
        const group = await this.getGroup(groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        const newMember: Member = {
            _id: (nextMemberId++).toString(),
            ...memberData,
        };
        group.members.push(newMember);
        return newMember;
    }
}

export class Database {
    private static instance: Database;
    private groupService: GroupService;

    private constructor() {
        this.groupService = new GroupService();
    }

    public static async initialize(uri: string): Promise<Database> {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }

    public getGroupService(): GroupService {
        return this.groupService;
    }
}
