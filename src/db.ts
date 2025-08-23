import { Database } from '@axyor/family-serve-database';

let db: Database;

export const initializeDatabase = async (mongoUri: string) => {
    db = await Database.initialize(mongoUri);
    return db;
};

export const setDatabase = (database: Database) => { db = database; };
export const getDatabase = () => {
    if (!db) throw new Error('Database not initialized');
    return db;
};

export const disconnectDatabase = async () => {
    if (db) await db.disconnect();
};
