
export enum EDietaryRestriction {
    VEGETARIAN = 'VEGETARIAN',
    VEGAN = 'VEGAN',
    GLUTEN_FREE = 'GLUTEN_FREE',
    DAIRY_FREE = 'DAIRY_FREE',
}

export enum EGroupRole {
    ADMIN = 'ADMIN',
    MEMBER = 'MEMBER',
}

export enum EGender {
    MALE = 'MALE',
    FEMALE = 'FEMALE'
}

export enum EActivityLevel {
    SEDENTARY = 'SEDENTARY',
    LIGHTLY_ACTIVE = 'LIGHTLY_ACTIVE',
    MODERATELY_ACTIVE = 'MODERATELY_ACTIVE',
    VERY_ACTIVE = 'VERY_ACTIVE',
}

export interface IMemberProfile {
    readonly id: string;
    role: EGroupRole;
    firstName: string;
    lastName: string;
    age: number;
    gender: EGender;
    activityLevel?: EActivityLevel;
    healthGoals?: string[];
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

export interface IGroup {
    readonly _id: string;
    name: string;
    members: IMemberProfile[];
    updatedAt: Date;
    readonly createdAt: Date;
}