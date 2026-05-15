import { spawn } from 'child_process';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import net from 'net';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let serverProcess;
let mainWindow;
let currentPort;
/**
 * Get environment variables
 */
function getEnv() {
    const isDev = !app.isPackaged;
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'local.db');
    return {
        isDev,
        userDataPath,
        dbPath,
        DATABASE_URL: isDev ? 'local.db' : dbPath
    };
}
/**
 * Find a free port on the local machine
 */
async function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, () => {
            const address = server.address();
            const port = typeof address === 'string' ? 0 : address?.port;
            server.close(() => {
                if (port) {
                    resolve(port);
                }
                else {
                    reject(new Error('No port found'));
                }
            });
        });
    });
}
async function initializeDatabase(dbPath) {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    console.log('Database path ensured at:', dbPath);
}
function startServer(port) {
    const env = getEnv();
    const serverPath = path.join(__dirname, 'build', 'index.js');
    if (!fs.existsSync(serverPath)) {
        console.error('Server build not found at:', serverPath);
        return;
    }
    serverProcess = spawn(process.execPath, [serverPath], {
        env: {
            ...process.env,
            DATABASE_URL: env.DATABASE_URL,
            PORT: port.toString(),
            ORIGIN: `http://localhost:${port}`,
            NODE_ENV: 'production',
            PROTOCOL_HEADER: 'x-forwarded-proto',
            HOST_HEADER: 'host',
            BODY_SIZE_LIMIT: '0'
        }
    });
    serverProcess.stdout?.on('data', async (data) => {
        const output = data.toString();
        console.log(`Server: ${output}`);
        // Adapter-node listening message
        if (output.includes('Listening on') || output.includes('localhost:')) {
            if (mainWindow) {
                await mainWindow.loadURL(`http://localhost:${port}`);
            }
        }
    });
    serverProcess.stderr?.on('data', (data) => {
        console.error(`Server Error: ${data}`);
    });
}
function createWindow(port) {
    const isMac = process.platform === 'darwin';
    const iconPath = isMac
        ? path.join(__dirname, 'icons', 'MDL-Icon-Mac-Default@1x.icns')
        : path.join(__dirname, 'icons', 'MDL-Icon-Default.png');
    mainWindow = new BrowserWindow({
        title: 'My Doryoku Log',
        width: 1600,
        height: 1000,
        icon: iconPath,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.loadURL(`http://localhost:${port}`).catch(() => {
        console.log('Server is not ready yet...');
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
app.whenReady().then(async () => {
    const env = getEnv();
    await initializeDatabase(env.dbPath);
    currentPort = await getFreePort();
    startServer(currentPort);
    createWindow(currentPort);
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow(currentPort);
        }
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});
// IPC handlers for CSV operations
ipcMain.handle('show-save-dialog', async (_event, options) => {
    return await dialog.showSaveDialog(mainWindow, options);
});
ipcMain.handle('show-open-dialog', async (_event, options) => {
    return await dialog.showOpenDialog(mainWindow, options);
});
ipcMain.handle('show-message-box', async (_event, options) => {
    return await dialog.showMessageBox(mainWindow, options);
});
