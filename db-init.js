import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Get migration files
 * @param migrationsDir
 * @returns {string[]}
 */
function getMigrationFiles(migrationsDir) {
	if (!fs.existsSync(migrationsDir)) {
		throw new Error(`Migrations directory not found: ${migrationsDir}`);
	}

	const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });

	const entryFiles = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
		.map((entry) => path.join(migrationsDir, entry.name))
		.sort();

	if (entryFiles.length === 0) {
		throw new Error(`No migration SQL files found in: ${migrationsDir}`);
	}

	return entryFiles;
}

/**
 * Check database and apply migrations
 * @param dbPath
 * @param migrationsDir
 */
export function checkDatabase(dbPath, migrationsDir) {
	const dbDir = path.dirname(dbPath);

	console.log('[db-init] dbPath =', dbPath);
	console.log('[db-init] migrationsDir =', migrationsDir);
	console.log('[db-init] dbDir exists =', fs.existsSync(dbDir));
	console.log('[db-init] migrationsDir exists =', fs.existsSync(migrationsDir));

	if (!fs.existsSync(dbDir)) {
		fs.mkdirSync(dbDir, { recursive: true });
	}

	const db = new Database(dbPath);

	db.exec(`
		CREATE TABLE IF NOT EXISTS __app_migrations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`);

	const applied = new Set(
		db
			.prepare('SELECT name FROM __app_migrations')
			.all()
			.map((row) => row.name)
	);

	const files = getMigrationFiles(migrationsDir);
	console.log('[db-init] migration files =', files);

	for (const file of files) {
		const name = path.basename(file);

		if (applied.has(name)) {
			console.log('[db-init] already applied:', name);
			continue;
		}

		console.log('[db-init] applying:', name);
		const sql = fs.readFileSync(file, 'utf8');

		const tx = db.transaction(() => {
			db.exec(sql);
			db.prepare('INSERT INTO __app_migrations (name) VALUES (?)').run(name);
		});

		tx();
	}

	const tables = db
		.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
		.all();
	console.log('[db-init] tables after migration =', tables);

	db.close();
}
