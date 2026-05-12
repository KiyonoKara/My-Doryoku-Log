import {
	contextBridge,
	ipcRenderer,
	type SaveDialogOptions,
	type OpenDialogOptions,
	type MessageBoxOptions
} from 'electron';

contextBridge.exposeInMainWorld('electron', {
	showSaveDialog: (options: SaveDialogOptions) => {
		if (options && typeof options !== 'object') {
			throw new Error('Invalid options');
		}
		return ipcRenderer.invoke('show-save-dialog', options);
	},
	showOpenDialog: (options: OpenDialogOptions) => {
		if (options && typeof options !== 'object') {
			throw new Error('Invalid options');
		}
		return ipcRenderer.invoke('show-open-dialog', options);
	},
	showMessageBox: (options: MessageBoxOptions) => {
		if (options && typeof options !== 'object') {
			throw new Error('Invalid options');
		}
		return ipcRenderer.invoke('show-message-box', options);
	}
});
