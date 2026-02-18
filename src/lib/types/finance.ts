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
