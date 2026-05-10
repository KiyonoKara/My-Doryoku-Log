import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
	showSaveDialog: (options: never) => ipcRenderer.invoke('show-save-dialog', options),
	showOpenDialog: (options: never) => ipcRenderer.invoke('show-open-dialog', options),
	showMessageBox: (options: never) => ipcRenderer.invoke('show-message-box', options)
});
