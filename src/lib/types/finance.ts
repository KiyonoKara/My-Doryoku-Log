export type TxType = 'income' | 'expense';

export const EXPENSE_CATEGORIES = [
	'Groceries',
	'Dining',
	'Entertainment',
	'Travel',
	'Merchandise',
	'Other',
	'Other Services',
	'Rent'
];

export const INCOME_CATEGORIES = [
	'Salary',
	'Allowance',
	'Stocks',
	'Interest & Dividends',
	'Reimbursements',
	'Gifts',
	'Sales'
];

export const MAX_DESCRIPTION_LENGTH = 100;

export const ALL_CATEGORIES = EXPENSE_CATEGORIES.concat(INCOME_CATEGORIES);

export type TransactionCategory = (typeof EXPENSE_CATEGORIES | typeof INCOME_CATEGORIES)[number];

export interface FinMLPrediction {
	type: string;
	coarse_category: string;
	amount: number;
}

export interface FinMLPredictionResponse {
	success: boolean;
	n_transactions: number;
	pred?: FinMLPrediction;
}

