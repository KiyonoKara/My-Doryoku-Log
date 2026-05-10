const STORAGE_KEY = 'doryoku-currency';
const DEFAULT: Currency = 'USD';

function createCurrencyStore() {
	let current = $state<Currency>(DEFAULT);

	function init() {
		if (typeof localStorage === 'undefined') {
			return;
		}
		const saved = localStorage.getItem(STORAGE_KEY) as Currency | null;
		// only supporting $ and ¥, sorry
		if (saved && ['USD', 'JPY'].includes(saved)) {
			current = saved;
		}
	}

	function set(currency: Currency) {
		current = currency;
		localStorage.setItem(STORAGE_KEY, currency);
	}

	return {
		get current() {
			return current;
		},
		get symbol() {
			return current === DEFAULT ? '$' : '¥';
		},
		init,
		set
	};
}

export const currencyStore = createCurrencyStore();