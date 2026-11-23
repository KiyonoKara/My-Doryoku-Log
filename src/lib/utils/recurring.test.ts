import { describe, it, expect } from 'vitest';
import type { Transaction } from '$lib/server/db/schema';
import { detectRecurring, recurringDueBetween } from './recurring';

// dates are written as YYYY-MM-DD
function tx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: 1,
		date: '2026-01-15',
		amount: 300,
		category: 'Rent',
		type: 'expense',
		description: null,
		...overrides
	};
}

// four monthly rent charges, every gap is 30 days
function monthlyRent(): Transaction[] {
	return [
		tx({ id: 1, date: '2026-01-15' }),
		tx({ id: 2, date: '2026-02-14' }),
		tx({ id: 3, date: '2026-03-16' }),
		tx({ id: 4, date: '2026-04-15' })
	];
}

describe('recurring.ts', () => {
	describe('detectRecurring', () => {
		it('should detect a monthly charge from three or more matching gaps', () => {
			const items = detectRecurring(monthlyRent(), '2026-04-20');

			expect(items).toHaveLength(1);
			expect(items[0]).toMatchObject({
				type: 'expense',
				category: 'Rent',
				amount: 300,
				interval: 'monthly',
				lastDate: '2026-04-15',
				nextDate: '2026-05-15',
				occurrences: 4
			});
		});

		it('should reject a run whose amounts disagree', () => {
			const charges = [
				tx({ id: 1, date: '2026-01-15', amount: 300 }),
				tx({ id: 2, date: '2026-02-14', amount: 300 }),
				tx({ id: 3, date: '2026-03-16', amount: 1500 })
			];

			expect(detectRecurring(charges, '2026-04-20')).toEqual([]);
		});

		it('should reject two matching charges as a coincidence', () => {
			const charges = [tx({ id: 1, date: '2026-01-15' }), tx({ id: 2, date: '2026-02-14' })];

			expect(detectRecurring(charges, '2026-04-20')).toEqual([]);
		});

		it('should reject charges that fall on no known interval', () => {
			// three purchases inside one week are not a weekly commitment
			const charges = [
				tx({ id: 1, date: '2026-05-01', amount: 12, category: 'Dining' }),
				tx({ id: 2, date: '2026-05-02', amount: 12, category: 'Dining' }),
				tx({ id: 3, date: '2026-05-03', amount: 12, category: 'Dining' })
			];

			expect(detectRecurring(charges, '2026-05-10')).toEqual([]);
		});

		it('should accept a monthly charge whose gap drifts with month length', () => {
			const charges = [
				tx({ id: 1, date: '2026-01-05' }),
				tx({ id: 2, date: '2026-02-02' }),
				tx({ id: 3, date: '2026-03-04' }),
				tx({ id: 4, date: '2026-04-03' })
			];

			const items = detectRecurring(charges, '2026-04-10');

			expect(items).toHaveLength(1);
			expect(items[0].interval).toBe('monthly');
			expect(items[0].occurrences).toBe(4);
		});

		it('should carry a monthly charge across a year boundary', () => {
			const charges = [
				tx({ id: 1, date: '2025-11-15' }),
				tx({ id: 2, date: '2025-12-15' }),
				tx({ id: 3, date: '2026-01-14' })
			];

			const items = detectRecurring(charges, '2026-01-20');

			expect(items[0].interval).toBe('monthly');
			expect(items[0].nextDate).toBe('2026-02-13');
		});

		it('should roll the next date forward past today instead of reporting it overdue', () => {
			const charges = [
				tx({ id: 1, date: '2026-01-10' }),
				tx({ id: 2, date: '2026-02-09' }),
				tx({ id: 3, date: '2026-03-11' })
			];

			const items = detectRecurring(charges, '2026-06-01');

			expect(items[0].lastDate).toBe('2026-03-11');
			expect(items[0].nextDate).toBe('2026-06-09');
		});

		it('should not depend on the order of the input', () => {
			const charges = monthlyRent();
			const shuffled = [charges[2], charges[0], charges[3], charges[1]];

			expect(detectRecurring(shuffled, '2026-04-20')).toEqual(
				detectRecurring(charges, '2026-04-20')
			);
		});

		it('should detect recurring income', () => {
			const charges = [
				tx({ id: 1, date: '2026-01-31', amount: 2400, category: 'Salary', type: 'income' }),
				tx({ id: 2, date: '2026-03-02', amount: 2400, category: 'Salary', type: 'income' }),
				tx({ id: 3, date: '2026-04-01', amount: 2400, category: 'Salary', type: 'income' })
			];

			const items = detectRecurring(charges, '2026-04-10');

			expect(items).toHaveLength(1);
			expect(items[0]).toMatchObject({ type: 'income', category: 'Salary', interval: 'monthly' });
		});

		it('should emit at most one commitment per type and category', () => {
			const charges = [
				...monthlyRent(),
				tx({ id: 5, date: '2026-01-03', amount: 45, category: 'Dining' }),
				tx({ id: 6, date: '2026-01-10', amount: 45, category: 'Dining' }),
				tx({ id: 7, date: '2026-01-17', amount: 45, category: 'Dining' })
			];

			const items = detectRecurring(charges, '2026-04-20');

			expect(items).toHaveLength(2);
			expect(items.map((item) => item.category).sort()).toEqual(['Dining', 'Rent']);
			// dining charges are a week apart
			expect(items.find((item) => item.category === 'Dining')?.interval).toBe('weekly');
		});

		it('should return nothing for an empty history', () => {
			expect(detectRecurring([], '2026-04-20')).toEqual([]);
		});

		it('should sort the results by the next date', () => {
			const charges = [
				tx({ id: 1, date: '2026-01-20', category: 'Rent' }),
				tx({ id: 2, date: '2026-02-19', category: 'Rent' }),
				tx({ id: 3, date: '2026-03-21', category: 'Rent' }),
				tx({ id: 4, date: '2026-01-05', amount: 20, category: 'Dining' }),
				tx({ id: 5, date: '2026-01-12', amount: 20, category: 'Dining' }),
				tx({ id: 6, date: '2026-01-19', amount: 20, category: 'Dining' })
			];

			const items = detectRecurring(charges, '2026-04-01');

			expect(items[0].category).toBe('Dining');
			expect(items[1].category).toBe('Rent');
		});
	});

	describe('recurringDueBetween', () => {
		it('should include a charge landing inside the window', () => {
			const items = detectRecurring(monthlyRent(), '2026-04-20');

			const due = recurringDueBetween(items, '2026-05-01', '2026-05-31');

			expect(due).toHaveLength(1);
			expect(due[0].date).toBe('2026-05-15');
		});

		it('should exclude a charge landing outside the window', () => {
			const items = detectRecurring(monthlyRent(), '2026-04-20');

			expect(recurringDueBetween(items, '2026-04-01', '2026-04-30')).toEqual([]);
		});

		it('should return every occurrence of a charge that lands more than once', () => {
			const charges = [
				tx({ id: 1, date: '2026-05-01', amount: 20, category: 'Dining' }),
				tx({ id: 2, date: '2026-05-08', amount: 20, category: 'Dining' }),
				tx({ id: 3, date: '2026-05-15', amount: 20, category: 'Dining' })
			];
			const items = detectRecurring(charges, '2026-05-20');

			const due = recurringDueBetween(items, '2026-05-20', '2026-05-31');

			expect(due.map((entry) => entry.date)).toEqual(['2026-05-22', '2026-05-29']);
		});

		it('should return nothing when there are no commitments', () => {
			expect(recurringDueBetween([], '2026-05-01', '2026-05-31')).toEqual([]);
		});
	});
});
