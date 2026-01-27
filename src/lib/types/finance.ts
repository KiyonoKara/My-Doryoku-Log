export type TxType = 'income' | 'expense';

export const EXPENSE_CATEGORIES = [
	'Groceries',
	'Dining',
	'Entertainment',
	'Travel',
	'Merchandise',
	'Other',
	'Other Services'
] as const;

export const INCOME_CATEGORIES = [
	'Salary',
	'Allowance',
	'Stocks',
	'Interest & Dividends',
	'Reimbursements'
] as const;
