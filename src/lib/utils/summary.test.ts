import { describe, it, expect } from 'vitest';
import type { Transaction, TimeEntry } from '$lib/server/db/schema';
import {
	monthKey,
	previousDay,
	entryDay,
	summarizeMonth,
	summarizeDay,
	trackedDays,
	currentStreak,
	runningEntry,
	recentActivity,
	projectMonth
} from './summary';

function tx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: 1,
		date: '2026-11-17',
		amount: 10,
		category: 'Groceries',
		type: 'expense',
		description: null,
		...overrides
	};
}

// start_date and end_date are written without a trailing Z
// so they parse as local time and keeps entryDay assertions valid in any machine timezone
function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
	return {
		id: 1,
		task: 'Write tests',
		category: 'Coding',
		start_date: '2026-11-17T09:00:00',
		end_date: '2026-11-17T10:00:00',
		duration_ms: 3600000,
		...overrides
	};
}

describe('summary.ts', () => {
	describe('monthKey', () => {
		it('should reduce a YYYY-MM-DD date to its month', () => {
			expect(monthKey('2026-11-17')).toBe('2026-11');
			expect(monthKey('2000-01-01')).toBe('2000-01');
			expect(monthKey('2026-12-31')).toBe('2026-12');
		});

		it('should return the input unchanged when it is already a month key', () => {
			expect(monthKey('2026-11')).toBe('2026-11');
		});
	});

	describe('previousDay', () => {
		it('should return the day before', () => {
			expect(previousDay('2026-11-17')).toBe('2026-11-16');
			expect(previousDay('2026-11-02')).toBe('2026-11-01');
		});

		it('should step back across a month boundary', () => {
			expect(previousDay('2026-11-01')).toBe('2026-10-31');
			expect(previousDay('2026-03-01')).toBe('2026-02-28');
		});

		it('should step back across a year boundary', () => {
			expect(previousDay('2026-01-01')).toBe('2025-12-31');
		});

		it('should handle a leap day', () => {
			expect(previousDay('2024-03-01')).toBe('2024-02-29');
			expect(previousDay('2024-02-29')).toBe('2024-02-28');
		});

		it('should return an empty string for malformed input', () => {
			expect(previousDay('')).toBe('');
			expect(previousDay('invalid')).toBe('');
			expect(previousDay('2026-00-10')).toBe('');
		});
	});

	describe('entryDay', () => {
		it('should return the local YYYY-MM-DD day the session started', () => {
			expect(entryDay(entry({ start_date: '2026-11-17T09:00:00' }))).toBe('2026-11-17');
			expect(entryDay(entry({ start_date: '2026-11-17T23:59:00' }))).toBe('2026-11-17');
		});

		it('should attribute a session that runs past midnight to its start day', () => {
			const overnight = entry({
				start_date: '2026-11-17T23:00:00',
				end_date: '2026-11-18T01:00:00'
			});
			expect(entryDay(overnight)).toBe('2026-11-17');
		});

		it('should return an empty string for an unparseable start date', () => {
			expect(entryDay(entry({ start_date: 'not-a-date' }))).toBe('');
			expect(entryDay(entry({ start_date: '' }))).toBe('');
		});
	});

	describe('summarizeMonth', () => {
		it('should total income, expense, net and count for the month', () => {
			const rows = [
				tx({ id: 1, date: '2026-11-01', amount: 100, type: 'income' }),
				tx({ id: 2, date: '2026-11-15', amount: 30, type: 'expense' }),
				tx({ id: 3, date: '2026-11-30', amount: 20, type: 'expense' })
			];

			expect(summarizeMonth(rows, '2026-11')).toEqual({
				income: 100,
				expense: 50,
				net: 50,
				count: 3
			});
		});

		it('should ignore rows outside the requested month', () => {
			const rows = [
				tx({ id: 1, date: '2026-11-10', amount: 100, type: 'income' }),
				tx({ id: 2, date: '2026-10-31', amount: 999, type: 'expense' }),
				tx({ id: 3, date: '2026-12-01', amount: 999, type: 'expense' })
			];

			expect(summarizeMonth(rows, '2026-11')).toEqual({
				income: 100,
				expense: 0,
				net: 100,
				count: 1
			});
		});

		it('should report a negative net when expenses exceed income', () => {
			const rows = [
				tx({ id: 1, date: '2026-11-01', amount: 10, type: 'income' }),
				tx({ id: 2, date: '2026-11-02', amount: 40, type: 'expense' })
			];

			expect(summarizeMonth(rows, '2026-11').net).toBe(-30);
		});

		it('should return zeroes for an empty list', () => {
			expect(summarizeMonth([], '2026-11')).toEqual({
				income: 0,
				expense: 0,
				net: 0,
				count: 0
			});
		});

		it('should not let a neighbouring month leak into the net', () => {
			const rows = [
				tx({ id: 1, date: '2026-11-05', amount: 50, type: 'expense' }),
				tx({ id: 2, date: '2026-11-25', amount: 50, type: 'expense' })
			];

			expect(summarizeMonth(rows, '2026-11')).toEqual({
				income: 0,
				expense: 100,
				net: -100,
				count: 2
			});
		});
	});

	describe('summarizeDay', () => {
		it('should total duration and session count for the day', () => {
			const rows = [
				entry({ id: 1, start_date: '2026-11-17T09:00:00', duration_ms: 1800000 }),
				entry({ id: 2, start_date: '2026-11-17T14:00:00', duration_ms: 600000 }),
				entry({ id: 3, start_date: '2026-11-16T09:00:00', duration_ms: 9999999 })
			];

			expect(summarizeDay(rows, '2026-11-17')).toEqual({
				totalMs: 2400000,
				sessions: 2
			});
		});

		it('should exclude a running session because it has no recorded duration', () => {
			const rows = [
				entry({ id: 1, start_date: '2026-11-17T09:00:00', duration_ms: 1200000 }),
				entry({
					id: 2,
					start_date: '2026-11-17T11:00:00',
					end_date: null,
					duration_ms: 0
				})
			];

			expect(summarizeDay(rows, '2026-11-17')).toEqual({
				totalMs: 1200000,
				sessions: 1
			});
		});

		it('should ignore a negative duration rather than subtracting it', () => {
			const rows = [
				entry({ id: 1, start_date: '2026-11-17T09:00:00', duration_ms: 600000 }),
				entry({ id: 2, start_date: '2026-11-17T10:00:00', duration_ms: -600000 })
			];

			expect(summarizeDay(rows, '2026-11-17')).toEqual({
				totalMs: 600000,
				sessions: 1
			});
		});

		it('should return zeroes for an empty list', () => {
			expect(summarizeDay([], '2026-11-17')).toEqual({ totalMs: 0, sessions: 0 });
		});
	});

	describe('trackedDays', () => {
		it('should collect the distinct start days of completed sessions', () => {
			const rows = [
				entry({ id: 1, start_date: '2026-11-17T09:00:00', duration_ms: 1000 }),
				entry({ id: 2, start_date: '2026-11-17T15:00:00', duration_ms: 1000 }),
				entry({ id: 3, start_date: '2026-11-15T09:00:00', duration_ms: 1000 })
			];

			expect(trackedDays(rows)).toEqual(new Set(['2026-11-17', '2026-11-15']));
		});

		it('should skip sessions with no recorded duration', () => {
			const rows = [
				entry({ id: 1, start_date: '2026-11-17T09:00:00', duration_ms: 0 }),
				entry({ id: 2, start_date: '2026-11-17T10:00:00', duration_ms: -5 }),
				entry({ id: 3, start_date: '2026-11-17T11:00:00', duration_ms: 1000 })
			];

			expect(trackedDays(rows)).toEqual(new Set(['2026-11-17']));
		});

		it('should skip rows with an unparseable start date', () => {
			const rows = [entry({ id: 1, start_date: 'nope', duration_ms: 1000 })];

			expect(trackedDays(rows)).toEqual(new Set());
		});

		it('should return an empty set for an empty list', () => {
			expect(trackedDays([])).toEqual(new Set());
		});
	});

	describe('currentStreak', () => {
		it('should count consecutive days ending today', () => {
			const days = new Set(['2026-11-17', '2026-11-16', '2026-11-15']);
			expect(currentStreak(days, '2026-11-17')).toBe(3);
		});

		it('should count from yesterday when today has nothing logged yet', () => {
			const days = new Set(['2026-11-16', '2026-11-15', '2026-11-14']);
			expect(currentStreak(days, '2026-11-17')).toBe(3);
		});

		it('should stop at the first gap', () => {
			const days = new Set(['2026-11-17', '2026-11-15', '2026-11-14']);
			expect(currentStreak(days, '2026-11-17')).toBe(1);
		});

		it('should return zero when neither today nor yesterday has anything', () => {
			const days = new Set(['2026-11-15', '2026-11-14']);
			expect(currentStreak(days, '2026-11-17')).toBe(0);
		});

		it('should return zero for an empty set', () => {
			expect(currentStreak(new Set(), '2026-11-17')).toBe(0);
		});

		it('should count a single day as a streak of one', () => {
			expect(currentStreak(new Set(['2026-11-17']), '2026-11-17')).toBe(1);
		});

		it('should run across a month boundary', () => {
			const days = new Set(['2026-11-01', '2026-10-31', '2026-10-30']);
			expect(currentStreak(days, '2026-11-01')).toBe(3);
		});

		it('should run across a year boundary', () => {
			const days = new Set(['2026-01-01', '2025-12-31']);
			expect(currentStreak(days, '2026-01-01')).toBe(2);
		});

		it('should ignore future days', () => {
			const days = new Set(['2026-11-18', '2026-11-17', '2026-11-16']);
			expect(currentStreak(days, '2026-11-17')).toBe(2);
		});
	});

	describe('runningEntry', () => {
		it('should return the session without an end date', () => {
			const open = entry({ id: 7, end_date: null, duration_ms: 0 });
			expect(runningEntry([entry({ id: 1 }), open])).toBe(open);
		});

		it('should return null when every session is finished', () => {
			expect(runningEntry([entry({ id: 1 }), entry({ id: 2 })])).toBeNull();
		});

		it('should return null for an empty list', () => {
			expect(runningEntry([])).toBeNull();
		});
	});

	describe('recentActivity', () => {
		it('should merge both kinds and sort newest first', () => {
			const transactions = [
				tx({ id: 1, date: '2026-11-17', category: 'Rent' }),
				tx({ id: 2, date: '2026-11-15', category: 'Dining' })
			];
			const entries = [entry({ id: 3, end_date: '2026-11-16T10:00:00' })];

			const result = recentActivity(transactions, entries, 10);

			expect(result.map((item) => item.sortKey)).toEqual([
				'2026-11-17',
				'2026-11-16T10:00:00',
				'2026-11-15'
			]);
			expect(result[0].kind).toBe('transaction');
			expect(result[1].kind).toBe('time');
		});

		it('should respect the limit', () => {
			const transactions = [
				tx({ id: 1, date: '2026-11-17' }),
				tx({ id: 2, date: '2026-11-16' }),
				tx({ id: 3, date: '2026-11-15' })
			];

			expect(recentActivity(transactions, [], 2)).toHaveLength(2);
		});

		it('should exclude a running session', () => {
			const entries = [entry({ id: 1, end_date: null, duration_ms: 0 })];

			expect(recentActivity([], entries, 10)).toHaveLength(0);
		});

		it('should sort a same day session after a transaction', () => {
			const transactions = [tx({ id: 1, date: '2026-11-17' })];
			const entries = [entry({ id: 2, end_date: '2026-11-17T10:00:00' })];

			const result = recentActivity(transactions, entries, 10);

			expect(result[0].kind).toBe('time');
			expect(result[1].kind).toBe('transaction');
		});

		it('should return an empty list when there is nothing', () => {
			expect(recentActivity([], [], 5)).toEqual([]);
		});
	});

	describe('projectMonth', () => {
		it('should project the month total from the pace so far', () => {
			const transactions = [
				tx({ id: 1, date: '2026-11-05', amount: 100 }),
				tx({ id: 2, date: '2026-11-10', amount: 50 })
			];

			const result = projectMonth(transactions, '2026-11-15');

			expect(result.elapsedDays).toBe(15);
			expect(result.daysInMonth).toBe(30);
			expect(result.spent).toBe(150);
			// 150 over 15 days is 10 a day, over 30 days is 300
			expect(result.projected).toBe(300);
		});

		it('should withhold the projection before MIN_DAYS_TO_PROJECT days in', () => {
			const transactions = [tx({ id: 1, date: '2026-11-01', amount: 100 })];

			const result = projectMonth(transactions, '2026-11-02');

			expect(result.projected).toBeNull();
			// the running total is still reported so the caller can show something else
			expect(result.spent).toBe(100);
		});

		it('should project on the first day that meets the threshold', () => {
			const transactions = [tx({ id: 1, date: '2026-11-01', amount: 30 })];

			const result = projectMonth(transactions, '2026-11-03');

			expect(result.projected).toBe(300);
		});

		it('should compare against the previous month only up to the same day', () => {
			const transactions = [
				tx({ id: 1, date: '2026-10-05', amount: 100 }),
				tx({ id: 2, date: '2026-10-25', amount: 200 }),
				tx({ id: 3, date: '2026-11-05', amount: 40 })
			];

			const result = projectMonth(transactions, '2026-11-15');

			// the 25th of October has not happened yet by the 15th of November
			expect(result.byThisPointLastMonth).toBe(100);
			expect(result.spent).toBe(40);
		});

		it('should step the comparison back across a year boundary', () => {
			const transactions = [
				tx({ id: 1, date: '2025-12-04', amount: 80 }),
				tx({ id: 2, date: '2026-01-04', amount: 20 })
			];

			const result = projectMonth(transactions, '2026-01-10');

			expect(result.daysInMonth).toBe(31);
			expect(result.byThisPointLastMonth).toBe(80);
		});

		it('should take all of a shorter previous month when the day has no counterpart', () => {
			const transactions = [
				tx({ id: 1, date: '2026-02-10', amount: 60 }),
				tx({ id: 2, date: '2026-02-27', amount: 40 })
			];

			// March 31st has no February "equivalent", so all of February is compared
			const result = projectMonth(transactions, '2026-03-31');

			expect(result.byThisPointLastMonth).toBe(100);
		});

		it('should use the real length of February in a leap year', () => {
			expect(projectMonth([], '2028-02-10').daysInMonth).toBe(29);
			expect(projectMonth([], '2026-02-10').daysInMonth).toBe(28);
		});

		it('should leave a charge dated later in the month out of the running total', () => {
			const transactions = [
				tx({ id: 1, date: '2026-11-10', amount: 40 }),
				// logged ahead of time, so it is not spent yet and must not inflate the pace
				tx({ id: 2, date: '2026-11-22', amount: 300 })
			];

			const result = projectMonth(transactions, '2026-11-15');

			expect(result.spent).toBe(40);
			expect(result.projected).toBe(80);
		});

		it('should count expenses only and ignore income', () => {
			const transactions = [
				tx({ id: 1, date: '2026-11-05', amount: 90, type: 'expense' }),
				tx({ id: 2, date: '2026-11-05', amount: 5000, type: 'income' }),
				tx({ id: 3, date: '2026-10-05', amount: 7000, type: 'income' })
			];

			const result = projectMonth(transactions, '2026-11-15');

			expect(result.spent).toBe(90);
			expect(result.byThisPointLastMonth).toBe(0);
		});

		it('should report zero when the month has no expenses yet', () => {
			const transactions = [tx({ id: 1, date: '2026-10-05', amount: 90 })];

			const result = projectMonth(transactions, '2026-11-15');

			expect(result.spent).toBe(0);
			expect(result.projected).toBe(0);
			expect(result.byThisPointLastMonth).toBe(90);
		});

		it('should fall back to empty values when today is malformed', () => {
			expect(projectMonth([], 'nonsense')).toEqual({
				elapsedDays: 0,
				daysInMonth: 0,
				spent: 0,
				projected: null,
				byThisPointLastMonth: 0
			});
		});
	});
});
