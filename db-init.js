import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Get migration files
 * @param migrationsDir
 * @returns {string[]}
 */
function getMigrationFiles(migrationsDir) {
	const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });

	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
		.map((entry) => path.join(migrationsDir, entry.name))
		.sort();
}

/**
 * Check database and apply migrations
 * @param dbPath
 * @param migrationsDir
 */
export function checkDatabase(dbPath, migrationsDir) {
	const dbDir = path.dirname(dbPath);

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

	for (const file of files) {
		const name = path.basename(file);

		if (applied.has(name)) {
			continue;
		}

		const sql = fs.readFileSync(file, 'utf8');

		const tx = db.transaction(() => {
			db.exec(sql);
			db.prepare('INSERT INTO __app_migrations (name) VALUES (?)').run(name);
		});

		tx();
	}

	db.close();
}
