import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building, dev } from '$app/environment';
import path from 'path';

if (!env.DATABASE_URL && !building) {
	throw new Error('DATABASE_URL is not set');
}

const client = building ? null : new Database(env.DATABASE_URL);

export const db = building ? null : drizzle(client!, { schema });

// run migrations on startup if not building and not in dev mode
if (!building && !dev && client) {
	migrate(db!, {
		migrationsFolder: path.join(process.cwd(), 'drizzle')
	});
}
