import { CURRENCY_FORMATS } from '$lib/types/finance';
import { formatCurrency } from '$lib/utils/util';

const STORAGE_KEY = 'doryoku-currency';
const DEFAULT: Currency = 'USD';
const SUPPORTED = Object.keys(CURRENCY_FORMATS) as Currency[];

// this store only controls how amounts are displayed, it does not convert them
function createCurrencyStore() {
	let current = $state<Currency>(DEFAULT);

	function init() {
		if (typeof localStorage === 'undefined') {
			return;
		}
		const saved = localStorage.getItem(STORAGE_KEY) as Currency | null;
		if (saved && SUPPORTED.includes(saved)) {
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
			return CURRENCY_FORMATS[current].symbol;
		},
		get decimals() {
			return CURRENCY_FORMATS[current].decimals;
		},
		format(amount: number) {
			return formatCurrency(amount, current);
		},
		init,
		set
	};
}

export const currencyStore = createCurrencyStore();
