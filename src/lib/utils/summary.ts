import type { Transaction, TimeEntry } from '$lib/server/db/schema';
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

/**
 * The most recent YYYY-MM-DD a transaction was recorded, empty when there are none
 * @param transactions
 */
export function lastTransactionDate(transactions: Transaction[]): string {
	let latest = '';

	for (const tx of transactions) {
		if (tx.date > latest) {
			latest = tx.date;
		}
	}

	return latest;
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
 * The most recent YYYY-MM-DD with a completed session, empty when there are none
 * takes the set trackedDays returns so the duration rule isn't duplicated
 * @param days
 */
export function lastTrackedDay(days: Set<string>): string {
	let latest = '';

	for (const day of days) {
		if (day > latest) {
			latest = day;
		}
	}

	return latest;
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
