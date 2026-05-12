import {
	type SaveDialogOptions,
	type OpenDialogOptions,
	type MessageBoxOptions,
	type SaveDialogReturnValue,
	type OpenDialogReturnValue,
	type MessageBoxReturnValue
} from 'electron';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		electron: {
			showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogReturnValue>;
			showOpenDialog: (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>;
			showMessageBox: (options: MessageBoxOptions) => Promise<MessageBoxReturnValue>;
		};
	}
}

export {};
