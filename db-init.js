import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

// number of pre-migration snapshots to keep before pruning the oldest
const MAX_BACKUPS = 3;

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
 * Snapshot the database before pending migrations run, keeping only the newest few
 * @param db Open connection, checkpointed first so nothing is left stranded in the WAL
 * @param dbPath
 * @param pending Migration names about to be applied
 */
function backupDatabase(db, dbPath, pending) {
	if (pending.length === 0 || !fs.existsSync(dbPath)) {
		return;
	}

	// fold any WAL contents back into the main file so the copy is complete
	db.pragma('wal_checkpoint(TRUNCATE)');

	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const backupPath = `${dbPath}.pre-${stamp}.bak`;
	fs.copyFileSync(dbPath, backupPath);
	console.log('[db-init] backed up database to', backupPath);

	const dir = path.dirname(dbPath);
	const base = path.basename(dbPath);
	const backups = fs
		.readdirSync(dir)
		.filter((name) => name.startsWith(`${base}.pre-`) && name.endsWith('.bak'))
		.sort();

	// the stamp is ISO-derived, so sorting ascending puts the oldest first
	for (const stale of backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS))) {
		fs.rmSync(path.join(dir, stale), { force: true });
		console.log('[db-init] pruned old backup', stale);
	}
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

	// foreign keys stay off for this connection on purpose. the table rebuilds in
	// 0001_foundation depend on it, and PRAGMA foreign_keys is silently ignored
	// inside the transaction below, so it cannot be turned on from the SQL either.
	// getDb() enables enforcement on the application connection instead.

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

	// a database created before __app_migrations existed, or built in dev with
	// drizzle-kit push, already has the tables but no record of 0000. replaying it
	// would fail on "table already exists", so record it without executing it.
	const hasAppTables = db
		.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'transactions'")
		.get();

	if (applied.size === 0 && hasAppTables) {
		console.log('[db-init] existing schema found, recording 0000_wide_hex.sql as applied');
		db.prepare('INSERT OR IGNORE INTO __app_migrations (name) VALUES (?)').run(
			'0000_wide_hex.sql'
		);
		applied.add('0000_wide_hex.sql');
	}

	const files = getMigrationFiles(migrationsDir);
	console.log('[db-init] migration files =', files);

	const pending = files
		.map((file) => path.basename(file))
		.filter((name) => !applied.has(name));

	if (pending.length === 0) {
		console.log('[db-init] no pending migrations');
	} else {
		console.log('[db-init] pending migrations =', pending);
	}

	backupDatabase(db, dbPath, pending);

	for (const name of pending) {
		console.log('[db-init] applying:', name);
		const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8');

		const tx = db.transaction(() => {
			db.exec(sql);
			db.prepare('INSERT INTO __app_migrations (name) VALUES (?)').run(name);
		});

		tx();
	}

	// catch anything the rebuilds in 0001 may have orphaned
	const violations = db.pragma('foreign_key_check');
	if (violations.length > 0) {
		db.close();
		throw new Error(
			`Foreign key violations found after migration: ${JSON.stringify(violations)}`
		);
	}

	const tables = db
		.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
		.all();
	console.log('[db-init] tables after migration =', tables);

	db.close();
}
