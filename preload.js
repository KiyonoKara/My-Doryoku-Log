import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electron', {
	showSaveDialog: (options) => {
		if (options && typeof options !== 'object') {
			throw new Error('Invalid options');
		}
		return ipcRenderer.invoke('show-save-dialog', options);
	},
	showOpenDialog: (options) => {
		if (options && typeof options !== 'object') {
			throw new Error('Invalid options');
		}
		return ipcRenderer.invoke('show-open-dialog', options);
	},
	showMessageBox: (options) => {
		if (options && typeof options !== 'object') {
			throw new Error('Invalid options');
		}
		return ipcRenderer.invoke('show-message-box', options);
	}
});
