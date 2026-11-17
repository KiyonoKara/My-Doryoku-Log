import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
	transactions,
	time_entries,
	type Transaction,
	type TimeEntry
} from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

// load the dashboard with both sets of rows, summaries are derived on the client
export const load: PageServerLoad = async () => {
	try {
		// get db instance
		const db = getDb();
		const transactionRows: Transaction[] = await db
			.select()
			.from(transactions)
			.orderBy(desc(transactions.date), desc(transactions.id));
		const timeRows: TimeEntry[] = await db
			.select()
			.from(time_entries)
			.orderBy(desc(time_entries.start_date), desc(time_entries.id));

		return {
			transactions: transactionRows,
			timeEntries: timeRows
		};
	} catch (error) {
		console.error('[home load] failed:', error);
	}
};
