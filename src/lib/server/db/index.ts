import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

let sqlDb: Database.Database | null = null;
let database: ReturnType<typeof drizzle> | null = null;

function resolveDatabasePath() {
	return env.DATABASE_URL || 'local.db';
}

export function getDb() {
	if (database) {
		return database;
	}

	const dbPath = resolveDatabasePath();
	sqlDb = new Database(dbPath);
	database = drizzle(sqlDb, { schema });

	return database;
}

export function closeDb() {
	if (sqlDb) {
		sqlDb.close();
		sqlDb = null;
		sqlDb = null;
	}
}