import type { Transaction } from '$lib/server/db/schema';
import type { TxType } from '$lib/types/finance';
import { daysBetween, toYmd } from './util';

export type RecurringInterval = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

// real months are 28 to 31 days
// tolerance is in days either side of the nominal interval
const INTERVALS: { key: RecurringInterval; days: number; tolerance: number }[] = [
	{ key: 'weekly', days: 7, tolerance: 2 },
	{ key: 'biweekly', days: 14, tolerance: 3 },
	{ key: 'monthly', days: 30, tolerance: 5 },
	{ key: 'quarterly', days: 91, tolerance: 10 },
	{ key: 'yearly', days: 365, tolerance: 15 }
];

const MIN_OCCURRENCES = 3;

// charges of the same kind drift a little between months
// the run is held to within 10% of its median
const AMOUNT_TOLERANCE = 0.1;

export type RecurringItem = {
	type: TxType;
	category: string;
	amount: number;
	interval: RecurringInterval;
	lastDate: string;
	nextDate: string;
	occurrences: number;
};

export type DueOccurrence = {
	item: RecurringItem;
	date: string;
};

/**
 * Local midnight for a YYYY-MM-DD date
 * Built from parts, so it can never shift a day across timezones
 * @param ymd YYYY-MM-DD
 */
function toLocalDate(ymd: string): Date | null {
	const [yyyy, mm, dd] = ymd.split('-').map(Number);
	if (!yyyy || !mm || !dd) {
		return null;
	}
	return new Date(yyyy, mm - 1, dd);
}

/**
 * YYYY-MM-DD shifted by a whole number of days
 * @param ymd YYYY-MM-DD
 * @param days number of days to shift
 */
function addDays(ymd: string, days: number): string {
	const d = toLocalDate(ymd);
	if (!d) {
		return ymd;
	}
	d.setDate(d.getDate() + days);
	return toYmd(d);
}

/**
 * Gets median value of a list of numbers
 * @param nums array of numbers
 */
function median(nums: number[]): number {
	if (!nums.length) {
		return 0;
	}
	const sorted = [...nums].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Whether every amount in a run is within AMOUNT_TOLERANCE of the median
 * @param amounts
 */
function amountsAgree(amounts: number[]): boolean {
	const mid = median(amounts);
	if (mid === 0) {
		// a run of zero amounts is not something to hold a budget against
		return false;
	}
	return amounts.every((amount) => Math.abs(amount - mid) <= mid * AMOUNT_TOLERANCE);
}

/**
 * Whether every gap in a run is inside the interval's tolerance
 * @param dates array of YYYY-MM-DD dates
 * @param interval 7, 14, 30, 91, 365 days
 */
function gapsAgree(
	dates: string[],
	interval: { days: number; tolerance: number }
): { ok: boolean; meanError: number } {
	let totalError = 0;
	for (let i = 1; i < dates.length; i++) {
		const gap = daysBetween(dates[i - 1], dates[i]);
		const error = Math.abs(gap - interval.days);
		if (error > interval.tolerance) {
			return {
				ok: false,
				meanError: Infinity
			};
		}
		totalError += error;
	}

	return { ok: true, meanError: totalError / Math.max(1, dates.length - 1) };
}

/**
 * Longest run of a group's charges that repeats on one interval
 * @param group transactions of a single type and category, oldest first
 * @param interval 7, 14, 30, 91, 365 days
 */
function longestRun(
	group: Transaction[],
	interval: { key: RecurringInterval; days: number; tolerance: number }
): { group: Transaction[]; meanError: number } | null {
	let best: { group: Transaction[]; meanError: number } | null = null;

	for (let start = 0; start < group.length; start++) {
		for (let end = start + MIN_OCCURRENCES; end <= group.length; end++) {
			const run = group.slice(start, end);
			const dates = run.map((tx) => tx.date);
			const amounts = run.map((tx) => tx.amount);

			const gaps = gapsAgree(dates, interval);
			if (!gaps.ok || !amountsAgree(amounts)) {
				break;
			}

			if (
				!best ||
				run.length > best.group.length ||
				(run.length === best.group.length && gaps.meanError < best.meanError)
			) {
				best = { group: run, meanError: gaps.meanError };
			}
		}
	}

	return best;
}

/**
 * Repeating charges found in the transaction history
 * Kept to the interval with the longest matching run
 * Category is never reported as both weekly and monthly
 * @param transactions
 * @param today YYYY-MM-DD and used to roll the next date forward
 */
export function detectRecurring(transactions: Transaction[], today: string): RecurringItem[] {
	const groups = new Map<string, Transaction[]>();

	for (const tx of transactions) {
		const key = `${tx.type}|${tx.category}`;
		const group = groups.get(key);
		if (group) {
			group.push(tx);
		} else {
			groups.set(key, [tx]);
		}
	}

	const items: RecurringItem[] = [];

	for (const group of groups.values()) {
		if (group.length < MIN_OCCURRENCES) {
			continue;
		}

		const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
		let best: {
			run: Transaction[];
			interval: (typeof INTERVALS)[number];
			meanError: number;
		} | null = null;

		for (const interval of INTERVALS) {
			const found = longestRun(sorted, interval);
			if (!found) {
				continue;
			}

			if (
				!best ||
				found.group.length > best.run.length ||
				(found.group.length === best.run.length && found.meanError < best.meanError)
			) {
				best = { run: found.group, interval, meanError: found.meanError };
			}
		}

		if (!best) {
			continue;
		}

		const lastDate = best.run[best.run.length - 1].date;
		// a charge that was due before today and never logged is treated as next month's
		let nextDate = addDays(lastDate, best.interval.days);
		while (nextDate < today) {
			const stepped = addDays(nextDate, best.interval.days);
			// an unparseable date comes back unchanged, so stepping would never advance
			if (stepped === nextDate) {
				break;
			}
			nextDate = stepped;
		}

		items.push({
			type: best.run[0].type as TxType,
			category: best.run[0].category,
			amount: median(best.run.map((tx) => tx.amount)),
			interval: best.interval.key,
			lastDate,
			nextDate,
			occurrences: best.run.length
		});
	}

	return items.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

/**
 * Every date a recurring charge lands on between two dates inclusive
 * A weekly charge inside a month lands more than once
 * @param items
 * @param from YYYY-MM-DD inclusive
 * @param to YYYY-MM-DD inclusive
 */
export function recurringDueBetween(
	items: RecurringItem[],
	from: string,
	to: string
): DueOccurrence[] {
	const occurrences: DueOccurrence[] = [];

	for (const item of items) {
		const step = INTERVALS.find((interval) => interval.key === item.interval)?.days ?? 0;
		if (!step) {
			continue;
		}

		let date = item.nextDate;
		while (date <= to) {
			if (date >= from) {
				occurrences.push({ item, date });
			}
			const stepped = addDays(date, step);
			// an unparseable date comes back unchanged, so stepping would never advance
			if (stepped === date) {
				break;
			}
			date = stepped;
		}
	}

	return occurrences.sort((a, b) => a.date.localeCompare(b.date));
}
