import { describe, it, expect } from 'vitest';
import { buildDatasets } from './random_forest';
import type { Transaction } from '$lib/server/db/schema';

describe('forecasting logic (via buildDatasets)', () => {
	const mockTransactions: Transaction[] = [
		{
			id: 1,
			date: '2024-05-01',
			amount: 50,
			category: 'Groceries',
			type: 'expense',
			description: 'test'
		},
		{
			id: 2,
			date: '2024-05-02',
			amount: 1000,
			category: 'Salary',
			type: 'income',
			description: 'test'
		},
		{
			id: 3,
			date: '2024-05-03',
			amount: 20,
			category: 'Dining',
			type: 'expense',
			description: 'test'
		},
		{
			id: 4,
			date: '2024-05-04',
			amount: 30,
			category: 'Entertainment',
			type: 'expense',
			description: 'test'
		},
		{
			id: 5,
			date: '2024-05-05',
			amount: 40,
			category: 'Merchandise',
			type: 'expense',
			description: 'test'
		}
	];

	it('buildDatasets should correctly process transactions', () => {
		const datasets = buildDatasets(mockTransactions);

		expect(datasets.XExpClf.length).toBe(4);
		expect(datasets.XIncClf.length).toBe(1);

		// check expense features such as dow, month, amount, isWeekend, isMonthStart, isMonthEnd
		const dt = new Date('2024-05-01');
		const expectedDow = dt.getDay() === 0 ? 6 : dt.getDay() - 1;
		const expectedMonth = dt.getMonth() + 1;
		const expectedDom = dt.getDate();

		const firstExp = datasets.XExpClf[0];
		expect(firstExp[0]).toBe(expectedDow);
		expect(firstExp[1]).toBe(expectedMonth);
		// amount
		expect(firstExp[2]).toBe(50);
		expect(firstExp[3]).toBe(expectedDow >= 5 ? 1 : 0);
		expect(firstExp[4]).toBe(expectedDom <= 3 ? 1 : 0);
		expect(firstExp[5]).toBe(expectedDom >= 28 ? 1 : 0);
	});
});
