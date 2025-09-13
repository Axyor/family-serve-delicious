import { Database } from '@axyor/family-serve-database';

let db: Database | undefined;

export const initializeDatabase = async (mongoUri: string) => {
    console.log('� Initializing database connection...');
    db = await Database.initialize(mongoUri);
    console.log('✅ Database initialized successfully');
    return db;
};

export const setDatabase = (database: Database) => { 
    db = database; 
};

export const getDatabase = (): Database => {
    if (!db) throw new Error('Database not initialized. Call initializeDatabase() first.');
    return db;
};

export const disconnectDatabase = async () => {
    if (db) {
        console.log('🔄 Disconnecting from database...');
        await db.disconnect();
        console.log('✅ Database disconnected');
        db = undefined;
    }
};
