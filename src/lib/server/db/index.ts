import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import fs from 'node:fs';
import path from 'node:path';

let sqlDb: Database.Database | null = null;
let database: ReturnType<typeof drizzle> | null = null;

function resolveDatabasePath() {
	const dbPath = env.DATABASE_URL || 'local.db';
	console.error('[db] DATABASE_URL =', dbPath);
	console.error('[db] dirname exists =', fs.existsSync(path.dirname(dbPath)));
	console.error('[db] file exists =', fs.existsSync(dbPath));
	return dbPath;
}

export function getDb() {
	if (database) {
		return database;
	}

	const dbPath = resolveDatabasePath();
	sqlDb = new Database(dbPath);

	const tables = sqlDb
		.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
		.all();

	console.error('[db] tables =', tables);

	database = drizzle(sqlDb, { schema });
	return database;
}

export function closeDb() {
	if (sqlDb) {
		sqlDb.close();
		sqlDb = null;
		database = null;
	}
}
