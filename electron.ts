import { spawn, type ChildProcess } from 'child_process';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverProcess: ChildProcess | undefined;
let mainWindow: BrowserWindow | null;

interface Env {
	isDev: boolean;
	userDataPath: string;
	dbPath: string;
	DATABASE_URL: string;
	PORT: number;
}

function getEnv(): Env {
	const isDev = !app.isPackaged;
	const userDataPath = app.getPath('userData');
	const dbPath = path.join(userDataPath, 'local.db');

	return {
		isDev,
		userDataPath,
		dbPath,
		DATABASE_URL: dbPath,
		PORT: 5050
	};
}

async function initializeDatabase(dbPath: string): Promise<void> {
	console.log('Initializing database at:', dbPath);
}

function startServer(): void {
	const env = getEnv();
	const serverPath = path.join(__dirname, 'build', 'index.js');

	if (!fs.existsSync(serverPath)) {
		console.error('Server build not found at:', serverPath);
		return;
	}

	serverProcess = spawn('node', [serverPath], {
		env: {
			...process.env,
			DATABASE_URL: env.DATABASE_URL,
			PORT: env.PORT.toString(),
			NODE_ENV: 'production'
		}
	});

	serverProcess.stdout?.on('data', async (data: Buffer) => {
		console.log(`Server: ${data}`);
		if (data.toString().includes('Listening on')) {
			if (mainWindow) {
				await mainWindow.loadURL(`http://localhost:${env.PORT}`);
			}
		}
	});

	serverProcess.stderr?.on('data', (data: Buffer) => {
		console.error(`Server Error: ${data}`);
	});
}

function createWindow(): void {
	mainWindow = new BrowserWindow({
		width: 1600,
		height: 1000,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js')
		}
	});

	const env = getEnv();
	mainWindow.loadURL(`http://localhost:${env.PORT}`).catch(() => {
		console.log('Server is not ready yet...');
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

app.whenReady().then(async () => {
	const env = getEnv();
	await initializeDatabase(env.dbPath);
	startServer();
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('quit', () => {
	if (serverProcess) serverProcess.kill();
});

// IPC handlers for CSV operations
ipcMain.handle('show-save-dialog', async (_event, options) => {
	return await dialog.showSaveDialog(mainWindow!, options);
});

ipcMain.handle('show-open-dialog', async (_event, options) => {
	return await dialog.showOpenDialog(mainWindow!, options);
});

ipcMain.handle('show-message-box', async (_event, options) => {
	return await dialog.showMessageBox(mainWindow!, options);
});
