import { fork } from 'node:child_process';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { checkDatabase } from './db-init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverProcess = null;
let mainWindow = null;
let currentPort = null;
let isBootstrapping = false;

/**
 * Log messages only in development mode
 * @param args
 */
function safeLog(...args) {
	if (!app.isPackaged) {
		console.log(...args);
	}
}

/**
 * Log errors only in development mode
 * @param args
 */
function safeError(...args) {
	if (!app.isPackaged) {
		console.error(...args);
	}
}

/**
 * Get paths for app data
 * @returns {{userData: string, dataDir: string, dbPath: string}}
 */
function getPaths() {
	const userData = app.getPath('userData');
	const dataDir = path.join(userData, 'app-data');
	const dbPath = path.join(dataDir, 'local.db');

	return {
		userData,
		dataDir,
		dbPath
	};
}

/**
 * Get environment variables
 */
function getEnv() {
	const { dbPath } = getPaths();

	return {
		DATABASE_URL: dbPath,
		NODE_ENV: app.isPackaged ? 'production' : 'development'
	};
}

/**
 * Check that the data directory exists
 */
function checkDataDir() {
	const { dataDir } = getPaths();
	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir, { recursive: true });
	}
}

/**
 * Get the path to the server script
 * @returns {string}
 */
function getServerPath() {
	return app.isPackaged
		? path.join(process.resourcesPath, 'server', 'index.js')
		: path.join(__dirname, 'build', 'index.js');
}

/**
 * Get the path to the preload script
 * @returns {string}
 */
function getPreloadPath() {
	return path.join(__dirname, 'preload.cjs');
}

/**
 * Get icon path based on the platform
 * @returns {string}
 */
function getIconPath() {
	if (process.platform === 'darwin') {
		return path.join(__dirname, 'icons', 'MDL-Icon-Mac-Default@1x.icns');
	}
	if (process.platform === 'win32') {
		return path.join(__dirname, 'icons', 'MDL-Icon-Default.png');
	}
	return path.join(__dirname, 'icons', 'MDL-Icon-Default.png');
}

/**
 * Find a free port on the local machine
 * @returns {Promise<unknown>}
 */
function getFreePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.unref();
		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			const port = typeof address === 'object' && address ? address.port : null;
			server.close(() => {
				if (port) {
					resolve(port);
				} else {
					reject(new Error('No free port found'));
				}
			});
		});
	});
}

/**
 * Get the path to the migrations directory
 * @returns {string}
 */
function getMigrationsPath() {
	return app.isPackaged
		? path.join(process.resourcesPath, 'drizzle')
		: path.join(__dirname, 'drizzle');
}

/**
 * Wait for the local server to start
 * @param url
 * @param timeoutMs
 * @returns {Promise<unknown>}
 */
function waitForServer(url, timeoutMs = 15000) {
	const started = Date.now();

	return new Promise((resolve, reject) => {
		const tryRequest = () => {
			const req = http.get(url, (res) => {
				res.resume();
				if (res.statusCode && res.statusCode < 500) {
					resolve();
					return;
				}

				if (Date.now() - started > timeoutMs) {
					reject(new Error(`Server responded with ${res.statusCode}`));
					return;
				}

				setTimeout(tryRequest, 250);
			});

			req.on('error', () => {
				if (Date.now() - started > timeoutMs) {
					reject(new Error('Timed out waiting for local server'));
				} else {
					setTimeout(tryRequest, 250);
				}
			});

			req.setTimeout(2000, () => req.destroy());
		};

		tryRequest();
	});
}

/**
 * Stop the local server
 */
function stopServer() {
	if (serverProcess && !serverProcess.killed) {
		serverProcess.kill();
	}
	serverProcess = null;
}

/**
 * Create the main window
 * @returns {*|Electron.CrossProcessExports.BrowserWindow}
 */
function createWindow() {
	if (mainWindow && !mainWindow.isDestroyed()) {
		return mainWindow;
	}

	mainWindow = new BrowserWindow({
		title: 'My Doryoku Log',
		width: 1600,
		height: 1000,
		minWidth: 1100,
		minHeight: 700,
		show: false,
		icon: getIconPath(),
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: true,
			preload: getPreloadPath()
		}
	});

	mainWindow.on('ready-to-show', () => {
		mainWindow?.show();
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (validExternalUrl(url)) {
			void shell.openExternal(url);
		}
	})

	mainWindow.webContents.on('will-navigate', (event, url) => {
		if (validExternalUrl(url)) {
			event.preventDefault();
			void shell.openExternal(url);
		}
	});

	return mainWindow;
}

async function startServer(port) {
	const serverPath = getServerPath();

	if (!fs.existsSync(serverPath)) {
		throw new Error(`Server build not found at: ${serverPath}`);
	}

	const env = getEnv();
	const baseUrl = `http://127.0.0.1:${port}`;

	// start a local server
	serverProcess = fork(serverPath, [], {
		cwd: app.isPackaged ? process.resourcesPath : __dirname,
		stdio: 'pipe',
		env: {
			...process.env,
			DATABASE_URL: env.DATABASE_URL,
			NODE_ENV: env.NODE_ENV,
			HOST: '127.0.0.1',
			PORT: String(port),
			ORIGIN: baseUrl,
			PROTOCOL_HEADER: 'x-forwarded-proto',
			HOST_HEADER: 'host',
			BODY_SIZE_LIMIT: 'Infinity'
		}
	});

	serverProcess.stdout?.on('data', (data) => {
		safeLog(`[server] ${data.toString()}`);
	});

	serverProcess.stderr?.on('data', (data) => {
		safeError(`[server:error] ${data.toString()}`);
	});

	const exitedEarly = new Promise((_, reject) => {
		serverProcess.once('exit', (code, signal) => {
			serverProcess = null;
			reject(new Error(`Server exited before listening. code=${code} signal=${signal}`));
		});
	});

	await Promise.race([waitForServer(baseUrl), exitedEarly]);
	return baseUrl;
}

function focusMainWindow() {
	if (!mainWindow) {
		return;
	}
	if (mainWindow.isMinimized()) {
		mainWindow.restore();
	}
	mainWindow.focus();
}

/**
 * Bootstrap the app
 * @returns {Promise<void>}
 */
async function bootstrap() {
	if (isBootstrapping) {
		return;
	}
	isBootstrapping = true;

	try {
		checkDataDir();
		currentPort = await getFreePort();

		const { dbPath } = getPaths();
		const migrationsPath = getMigrationsPath();

		checkDatabase(dbPath, migrationsPath);

		const win = createWindow();
		const url = await startServer(currentPort);
		await win.loadURL(url);
	} finally {
		isBootstrapping = false;
	}
}

/**
 * Check if the URL is a valid external URL
 * @param url
 * @returns {boolean}
 */
function validExternalUrl(url) {
	try {
		const u = new URL(url);
		return u.protocol === 'http:' || u.protocol === 'https:';
	} catch {
		return false;
	}
}

const hasLock = app.requestSingleInstanceLock();

if (!hasLock) {
	app.quit();
} else {
	app.on('second-instance', () => {
		focusMainWindow();
	});

	// avoid opening the app multiple times
	app.whenReady().then(async () => {
		try {
			await bootstrap();
		} catch (error) {
			await dialog.showErrorBox(
				'Startup failed',
				error instanceof Error ? error.message : String(error)
			);
			app.quit();
		}

		app.on('activate', async () => {
			if (BrowserWindow.getAllWindows().length === 0) {
				try {
					await bootstrap();
				} catch (error) {
					await dialog.showErrorBox(
						'Startup failed',
						error instanceof Error ? error.message : String(error)
					);
					app.quit();
				}
			} else {
				focusMainWindow();
			}
		});
	});
}

// stop server when the app is quitting
app.on('before-quit', () => {
	stopServer();
});

// quit when all windows are closed
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

// IPC handlers for CSV operations
ipcMain.handle('show-save-dialog', async (_event, options) => {
	return dialog.showSaveDialog(mainWindow ?? undefined, options);
});

ipcMain.handle('show-open-dialog', async (_event, options) => {
	return dialog.showOpenDialog(mainWindow ?? undefined, options);
});

ipcMain.handle('show-message-box', async (_event, options) => {
	return dialog.showMessageBox(mainWindow ?? undefined, options);
});
