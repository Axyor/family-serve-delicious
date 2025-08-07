import { Database } from './mockDatabase.js';

export const initializeDatabase = async (): Promise<Database> => {
    // The mock database doesn't need a real URI
    return Database.initialize("mock://");
};
