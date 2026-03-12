const STORAGE_KEY = 'doryoku-theme';
const DEFAULT: Theme = 'blueberry';

// get system's preferred theme
function getSystemTheme(): Theme {
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? 'dark' : 'light';
}

// store theme
function createThemeStore() {
	let current = $state<Theme>(DEFAULT);

	function init() {
		if (typeof localStorage === 'undefined') {
			return;
		}
		const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
		if (saved && ['blueberry', 'system', 'light', 'dark'].includes(saved)) {
			current = saved;
		} else {
			current = getSystemTheme();
		}
		applyTheme(current);
	}

	function set(theme: Theme) {
		current = theme;
		localStorage.setItem(STORAGE_KEY, theme);
		applyTheme(theme);
	}

	function applyTheme(theme: Theme) {
		const resolved = theme === 'system' ? getSystemTheme() : theme;
		console.log(resolved);
		document.documentElement.setAttribute('data-theme', resolved);
	}

	return {
		get current() {
			return current;
		},
		init,
		set
	};
}

export const themeStore = createThemeStore();
