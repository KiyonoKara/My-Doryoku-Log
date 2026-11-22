import type { Transaction, TimeEntry } from '$lib/server/db/schema';
import { MIN_DAYS_TO_PROJECT } from '$lib/types/finance';
import { toYmd } from './util';

/**
 * Reduce a YYYY-MM-DD date to its YYYY-MM month key
 * @param ymd
 */
export function monthKey(ymd: string): string {
	return ymd.slice(0, 7);
}

/**
 * The YYYY-MM-DD day before the supplied one
 * @param ymd
 */
export function previousDay(ymd: string): string {
	const [yyyy, mm, dd] = ymd.split('-').map(Number);
	if (!yyyy || !mm || !dd) {
		return '';
	}

	const d = new Date(yyyy, mm - 1, dd);
	d.setDate(d.getDate() - 1);
	return toYmd(d);
}

/**
 * Local YYYY-MM-DD day a time entry belongs to a session past midnight counts as the day it started
 * @param entry
 */
export function entryDay(entry: TimeEntry): string {
	const start = Date.parse(entry.start_date);
	if (!Number.isFinite(start)) {
		return '';
	}
	return toYmd(new Date(start));
}

export type MonthSummary = {
	income: number;
	expense: number;
	net: number;
	count: number;
};

/**
 * Total income, expense, net and entry count for a single YYYY-MM month
 * @param transactions
 * @param month YYYY-MM key
 */
export function summarizeMonth(transactions: Transaction[], month: string): MonthSummary {
	let income = 0;
	let expense = 0;
	let count = 0;

	for (const tx of transactions) {
		if (monthKey(tx.date) !== month) {
			continue;
		}

		count++;
		if (tx.type === 'income') {
			income += tx.amount;
		} else {
			expense += tx.amount;
		}
	}

	return { income, expense, net: income - expense, count };
}

export type MonthProjection = {
	elapsedDays: number;
	daysInMonth: number;
	spent: number;
	projected: number | null;
	byThisPointLastMonth: number;
};

/**
 * Month-to-date expense total and where it is if the current pace holds
 * Projected stays are null until MIN_DAYS_TO_PROJECT days in
 * the comparison month is cut at the same day so a partial month isn't compared to a full one
 * @param transactions
 * @param today YYYY-MM-DD
 */
export function projectMonth(transactions: Transaction[], today: string): MonthProjection {
	const [yyyy, mm, dd] = today.split('-').map(Number);
	if (!yyyy || !mm || !dd) {
		return { elapsedDays: 0, daysInMonth: 0, spent: 0, projected: null, byThisPointLastMonth: 0 };
	}

	const month = monthKey(today);
	// day 0 of the following month is the last day of this one
	const daysInMonth = new Date(yyyy, mm, 0).getDate();

	const prevYyyy = mm === 1 ? yyyy - 1 : yyyy;
	const prevMm = mm === 1 ? 12 : mm - 1;
	const prevMonth = `${prevYyyy}-${String(prevMm).padStart(2, '0')}`;
	const prevDaysInMonth = new Date(prevYyyy, prevMm, 0).getDate();
	// the 31st has no counterpart in a 30-day month, so that day compares against all of it
	const compareDay = Math.min(dd, prevDaysInMonth);

	let spent = 0;
	let byThisPointLastMonth = 0;

	for (const tx of transactions) {
		if (tx.type !== 'expense') {
			continue;
		}

		const txMonth = monthKey(tx.date);
		if (txMonth === month) {
			// a charge dated later in the month has not been spent yet, counting it inflates the pace
			if (tx.date <= today) {
				spent += tx.amount;
			}
		} else if (txMonth === prevMonth && Number(tx.date.slice(8, 10)) <= compareDay) {
			byThisPointLastMonth += tx.amount;
		}
	}

	return {
		elapsedDays: dd,
		daysInMonth,
		spent,
		projected: dd >= MIN_DAYS_TO_PROJECT ? (spent / dd) * daysInMonth : null,
		byThisPointLastMonth
	};
}

export type DaySummary = {
	totalMs: number;
	sessions: number;
};

/**
 * Total tracked milliseconds and completed session count for one YYYY-MM-DD day
 * @param entries
 * @param day
 */
export function summarizeDay(entries: TimeEntry[], day: string): DaySummary {
	let totalMs = 0;
	let sessions = 0;

	for (const entry of entries) {
		if (entryDay(entry) !== day || entry.duration_ms <= 0) {
			continue;
		}

		sessions++;
		totalMs += entry.duration_ms;
	}

	return { totalMs, sessions };
}

/**
 * Every YYYY-MM-DD day with at least one completed session
 * @param entries
 */
export function trackedDays(entries: TimeEntry[]): Set<string> {
	const days = new Set<string>();

	for (const entry of entries) {
		if (entry.duration_ms <= 0) {
			continue;
		}

		const day = entryDay(entry);
		if (day) {
			days.add(day);
		}
	}

	return days;
}

/**
 * Number of consecutive tracked days counting back from today
 * a streak in progress isn't broken before there is a chance to log today
 * @param days
 * @param today YYYY-MM-DD
 */
export function currentStreak(days: Set<string>, today: string): number {
	let cursor = days.has(today) ? today : previousDay(today);
	let streak = 0;

	while (cursor && days.has(cursor)) {
		streak++;
		cursor = previousDay(cursor);
	}

	return streak;
}

/**
 * Gets the running session if there is one, there is at most one since two timers aren't allowed
 * @param entries
 */
export function runningEntry(entries: TimeEntry[]): TimeEntry | null {
	return entries.find((entry) => entry.end_date == null) ?? null;
}

export type ActivityItem =
	| { kind: 'transaction'; sortKey: string; transaction: Transaction }
	| { kind: 'time'; sortKey: string; entry: TimeEntry };

/**
 * Completed transactions and sessions merged into one list, newest first
 * a running session has no end date, so it is left out and shown separately
 * @param transactions
 * @param entries
 * @param limit
 */
export function recentActivity(
	transactions: Transaction[],
	entries: TimeEntry[],
	limit: number
): ActivityItem[] {
	const items: ActivityItem[] = [
		...transactions.map((tx) => ({
			kind: 'transaction' as const,
			sortKey: tx.date,
			transaction: tx
		})),
		...entries
			.filter((entry) => entry.end_date != null)
			.map((entry) => ({
				kind: 'time' as const,
				sortKey: entry.end_date ?? entry.start_date,
				entry
			}))
	];

	// a session carries a time component so it sorts newer than a same-day transaction
	return items.sort((a, b) => b.sortKey.localeCompare(a.sortKey)).slice(0, limit);
}
