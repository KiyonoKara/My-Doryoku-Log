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
			showSaveDialog: (options: never) => Promise<never>;
			showOpenDialog: (options: never) => Promise<never>;
			showMessageBox: (options: never) => Promise<never>;
		};
	}
}

export {};
