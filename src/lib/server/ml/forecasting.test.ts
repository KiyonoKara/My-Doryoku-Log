import { describe, it, expect } from 'vitest';
import { buildDatasets } from './random_forest';
import { forecastNextExpense, forecastNextIncome, futureDateFeatures } from './forecasting';
import { MIN_REQ_TRANSACTIONS } from '$lib/types/finance';
import type { Transaction } from '$lib/server/db/schema';

const mockTransactions: Transaction[] = [
	{
		id: 1,
		date: '2024-05-01',
		amount: 50,
		category: 'Groceries',
		type: 'expense',
		description: null
	},
	{
		id: 2,
		date: '2024-05-02',
		amount: 1000,
		category: 'Salary',
		type: 'income',
		description: null
	},
	{ id: 3, date: '2024-05-03', amount: 20, category: 'Dining', type: 'expense', description: null },
	{
		id: 4,
		date: '2024-05-04',
		amount: 30,
		category: 'Entertainment',
		type: 'expense',
		description: null
	},
	{
		id: 5,
		date: '2024-05-05',
		amount: 40,
		category: 'Merchandise',
		type: 'expense',
		description: null
	}
];

// rows are handed to the forecast directly so no test ever reaches the database
function expenses(count: number, startDay = 1): Transaction[] {
	return Array.from({ length: count }, (_, i) => ({
		id: i + 1,
		date: `2026-0${(i % 9) + 1}-${String((i % 27) + startDay).padStart(2, '0')}`,
		amount: 25 + i,
		category: 'Groceries',
		type: 'expense' as const,
		description: null
	}));
}

function salaries(count: number): Transaction[] {
	return Array.from({ length: count }, (_, i) => ({
		id: 100 + i,
		date: `2026-0${(i % 9) + 1}-01`,
		amount: 2400,
		category: 'Salary',
		type: 'income' as const,
		description: null
	}));
}

describe('buildDatasets', () => {
	it('should produce one row per transaction with a known category', () => {
		const datasets = buildDatasets(mockTransactions);

		expect(datasets.XExpClf.length).toBe(4);
		expect(datasets.XIncClf.length).toBe(1);
		expect(datasets.XExpReg.length).toBe(4);
		expect(datasets.XIncReg.length).toBe(1);
	});

	it('should build the classifier row from date features only', () => {
		const datasets = buildDatasets(mockTransactions);
		const dt = new Date('2024-05-01');
		const expectedDow = dt.getDay() === 0 ? 6 : dt.getDay() - 1;
		const expectedDom = dt.getDate();

		const firstExp = datasets.XExpClf[0];

		expect(firstExp).toHaveLength(5);
		expect(firstExp[0]).toBe(expectedDow);
		expect(firstExp[1]).toBe(dt.getMonth() + 1);
		expect(firstExp[2]).toBe(expectedDow >= 5 ? 1 : 0);
		expect(firstExp[3]).toBe(expectedDom <= 3 ? 1 : 0);
		expect(firstExp[4]).toBe(expectedDom >= 28 ? 1 : 0);
	});

	it('should keep the amount out of the classifier features', () => {
		const datasets = buildDatasets(mockTransactions);

		// 50 is the first expense amount, if it turns up the leak is back
		expect(datasets.XExpClf[0]).not.toContain(50);
		expect(datasets.XIncClf[0]).not.toContain(1000);
	});

	it('should hand the regressor the label the classifier is trained to predict', () => {
		const datasets = buildDatasets(mockTransactions);

		// the regressor's last input is the coarse id, which is exactly yExpClf
		expect(datasets.XExpReg[0][4]).toBe(datasets.yExpClf[0]);
		expect(datasets.XIncReg[0][4]).toBe(datasets.yIncClf[0]);
		// and the rest of its inputs are the classifier's features without isMonthEnd
		expect(datasets.XExpReg[0].slice(0, 4)).toEqual(datasets.XExpClf[0].slice(0, 4));
	});

	it('should ask the models for as many features as they were trained on', () => {
		const datasets = buildDatasets(mockTransactions);
		const { dow, month, isWeekend, isMonthStart, isMonthEnd } = futureDateFeatures(new Date());

		// predict time shapes have to match training or the trees compare against undefined
		expect([dow, month, isWeekend, isMonthStart, isMonthEnd]).toHaveLength(
			datasets.XExpClf[0].length
		);
		expect([dow, month, isWeekend, isMonthStart, datasets.yExpClf[0]]).toHaveLength(
			datasets.XExpReg[0].length
		);
	});
});

describe('forecastNextExpense', () => {
	it('should predict once the expense models can be trained', async () => {
		const rows = expenses(MIN_REQ_TRANSACTIONS);

		const result = await forecastNextExpense(rows);

		expect(result.success).toBe(true);
		expect(result.n_transactions).toBe(MIN_REQ_TRANSACTIONS);
		expect(result.pred.coarse_category).toBeTruthy();
		expect(typeof result.pred.amount).toBe('number');
	});

	it('should report not ready one row below the threshold', async () => {
		const result = await forecastNextExpense(expenses(MIN_REQ_TRANSACTIONS - 1));

		expect(result.success).toBe(false);
		expect(result.pred).toEqual({});
	});

	it('should report not ready with no rows at all', async () => {
		const result = await forecastNextExpense([]);

		expect(result.success).toBe(false);
		expect(result.n_transactions).toBe(0);
	});
});

describe('forecastNextIncome', () => {
	it('should report not ready when there is no income to train on', async () => {
		// expenses only is the shape that used to pass the gate, which counted every row
		const result = await forecastNextIncome(expenses(MIN_REQ_TRANSACTIONS));

		expect(result.success).toBe(false);
		expect(result.n_transactions).toBe(0);
		expect(result.pred).toEqual({});
	});

	it('should predict once the income models can be trained', async () => {
		const result = await forecastNextIncome(salaries(MIN_REQ_TRANSACTIONS));

		expect(result.success).toBe(true);
		expect(result.n_transactions).toBe(MIN_REQ_TRANSACTIONS);
		expect(result.pred.coarse_category).toBeTruthy();
	});

	it('should not be unlocked by expenses alone', async () => {
		const rows = [...expenses(MIN_REQ_TRANSACTIONS * 2), ...salaries(2)];

		const expenseResult = await forecastNextExpense(rows);
		const incomeResult = await forecastNextIncome(rows);

		// one side unlocking must not carry the other
		expect(expenseResult.success).toBe(true);
		expect(incomeResult.success).toBe(false);
		expect(incomeResult.n_transactions).toBe(2);
	});
});
