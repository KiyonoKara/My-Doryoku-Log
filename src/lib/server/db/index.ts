import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building, dev } from '$app/environment';
import path from 'path';
import fs from 'fs';

const databaseUrl = env.DATABASE_URL || 'local.db';

if (!databaseUrl && !building) {
	throw new Error('DATABASE_URL is not set');
}

const client = building ? null : new Database(databaseUrl);

export const db = building ? null : drizzle(client!, { schema });

// only run migrations in production and not dev or during build
if (!building && !dev && client) {
	const candidates = [
		process.env.DRIZZLE_MIGRATIONS_PATH,
		process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'drizzle') : null,
		path.join(process.cwd(), 'drizzle'),
	].filter(Boolean) as string[];

	const migrationsFolder = candidates.find((p) => fs.existsSync(p)) ?? path.join(process.cwd(), 'drizzle');

	try {
		migrate(db!, { migrationsFolder });
	} catch (error: unknown) {
			console.error(error);
	}
}
