import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { transactions, type Transaction } from '$lib/server/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { forecastNextExpense, forecastNextIncome } from '$lib/server/ml/forecasting';
import { MAX_DESCRIPTION_LENGTH } from '$lib/types/finance';
import { parseCSVLine } from '$lib/utils/util';

// load page with this
export const load: PageServerLoad = async () => {
	const rows: Transaction[] = await db
		.select()
		.from(transactions)
		.orderBy(desc(transactions.date), desc(transactions.id))
		.limit(50);
	const expenseForecast = await forecastNextExpense();
	const incomeForecast = await forecastNextIncome();

	return {
		transactions: rows as Transaction[],
		expenseForecast,
		incomeForecast
	};
};

export const actions: Actions = {
	// for submitting transactions
	submit: async ({ request }) => {
		if (request.method !== 'POST') {
			return fail(405, {
				success: false,
				message: 'Method not allowed'
			});
		}

		const formData = await request.formData();

		const date = formData.get('date');
		const amount = formData.get('amount');
		const category = formData.get('category');
		const type = formData.get('type');
		const description = formData.get('description');

		if (
			typeof date !== 'string' ||
			typeof amount !== 'string' ||
			typeof category !== 'string' ||
			typeof type !== 'string'
		) {
			return fail(400, { success: false, message: 'Invalid form data' });
		}

		// needs to be a real number
		const parsedAmount = Number(amount);
		if (!Number.isFinite(parsedAmount)) {
			return fail(400, {
				success: false,
				message: 'Amount must be a number'
			});
		}

		// there should only be two types
		if (type !== 'income' && type !== 'expense') {
			return fail(400, {
				success: false,
				message: 'Invalid type'
			});
		}

		if (typeof description === 'string' && description.length > MAX_DESCRIPTION_LENGTH) {
			return fail(400, {
				success: false,
				message: `Description cannot be over ${MAX_DESCRIPTION_LENGTH} characters`
			});
		}

		await db.insert(transactions).values({
			date,
			amount: parsedAmount,
			category,
			type,
			description: typeof description === 'string' && description.length > 0 ? description : null
		});

		return {
			success: true,
			action: 'submit',
			message: 'Entry saved'
		};
	},
	// for deleting transactions
	delete: async ({ request }) => {
		if (request.method !== 'POST') {
			return fail(405, {
				success: false,
				message: 'Method not allowed'
			});
		}

		const formData = await request.formData();
		const id = Number(formData.get('id'));

		if (!Number.isFinite(id)) {
			return fail(400, {
				success: false,
				message: 'Invalid ID'
			});
		}

		await db.delete(transactions).where(eq(transactions.id, id));

		return {
			success: true,
			deleted: true,
			message: 'Entry deleted'
		};
	},

	// for editing and updating transactions
	update: async ({ request }) => {
		if (request.method !== 'POST') {
			return fail(405, { success: false, message: 'Method not allowed' });
		}
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const date = formData.get('date');
		const amount = formData.get('amount');
		const category = formData.get('category');
		const type = formData.get('type');
		const description = formData.get('description');

		if (!Number.isFinite(id)) {
			return fail(400, {
				success: false,
				message: 'Invalid ID'
			});
		}

		if (
			typeof date !== 'string' ||
			typeof amount !== 'string' ||
			typeof category !== 'string' ||
			typeof type !== 'string'
		) {
			return fail(400, {
				success: false,
				message: 'Invalid form data'
			});
		}

		const parsedAmount = Number(amount);
		if (!Number.isFinite(parsedAmount)) {
			return fail(400, {
				success: false,
				message: 'Amount must be a number'
			});
		}

		if (type !== 'income' && type !== 'expense') {
			return fail(400, {
				success: false,
				message: 'Invalid type'
			});
		}

		await db
			.update(transactions)
			.set({
				date,
				amount: parsedAmount,
				category,
				type,
				description: typeof description === 'string' && description.length > 0 ? description : null
			})
			.where(eq(transactions.id, id));
		return {
			success: true,
			action: 'update',
			message: 'Entry updated'
		};
	},

	// for deleting multiple transactions
	bulkDelete: async ({ request }) => {
		if (request.method !== 'POST') {
			return fail(405, {
				success: false,
				message: 'Method not allowed'
			});
		}

		const formData = await request.formData();
		const rawIds = formData.getAll('ids');
		const ids = rawIds.map(Number).filter(Number.isFinite) as number[];

		if (ids.length === 0) {
			return fail(400, {
				success: false,
				message: 'No IDs provided'
			});
		}

		await db.delete(transactions).where(inArray(transactions.id, ids));
		return {
			success: true,
			action: 'bulkDelete',
			message: `${ids.length} entries deleted`
		};
	},

	// for importing CSV data
	importCsv: async ({ request }) => {
		if (request.method !== 'POST') {
			return fail(405, {
				success: false,
				message: 'Method not allowed'
			});
		}

		const formData = await request.formData();
		const mode = formData.get('mode');
		const file = formData.get('file');

		// check valid modes
		if (mode !== 'append' && mode !== 'replace') {
			return fail(400, {
				success: false,
				message: 'Invalid mode'
			});
		}
		// no file provided
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, {
				success: false,
				message: 'No file provided'
			});
		}

		const text = await file.text();
		const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

		// parse CSV lines
		const header = parseCSVLine(lines[0] ?? '').map(h => h.trim().toLowerCase());
		const required = ['date', 'amount', 'category', 'type'];
		for (const col of required) {
			if (!header.includes(col))
				return fail(400, {
					success: false,
					message: `Missing required column: ${col}`
				});
		}

		const csvDate = header.indexOf('date');
		const csvAmount = header.indexOf('amount');
		const csvCategory = header.indexOf('category');
		const csvType = header.indexOf('type');
		const csvDescription = header.indexOf('description');
		const csvId = header.indexOf('id');

		const rows: Transaction[] = [];
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) {
				continue;
			}

			const cols = parseCSVLine(line);
			const date = cols[csvDate]?.trim() ?? '';
			const amount = cols[csvAmount]?.trim() ?? '';
			const category = cols[csvCategory]?.trim() ?? '';
			const trType = cols[csvType]?.trim().toLowerCase() ?? '';
			const description = csvDescription >= 0 ? (cols[csvDescription]?.trim() || null) : null;
			const id = csvId >= 0 ? Number(cols[csvId]?.trim()) : NaN;

			// validate date
			if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
				return fail(400, { success: false, message: `Row ${i}: invalid date "${date}"` });
			}
			// check values
			const parsedAmount = Number(amount);
			if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
				return fail(400, {
					success: false,
					message: `Row ${i}: invalid amount "${parsedAmount}"`
				});
			}
			if (trType !== 'income' && trType !== 'expense') {
				return fail(400, {
					success: false,
					message: `Row ${i}: invalid type "${trType}"`
				});
			}
			if (!category) {
				return fail(400, {
					success: false,
					message: `Row ${i}: category is empty`
				});
			}
			rows.push({
				id: id ?? 0,
				date,
				amount: parsedAmount,
				category,
				type: trType,
				description
			});
		}

		// if no rows
		if (rows.length === 0)
			return fail(400, {
				success: false,
				message: 'No valid rows found in CSV'
			});

		// replace everything
		if (mode === 'replace') {
			await db.delete(transactions);
			await db.insert(transactions).values(
				rows.map(r => ({
					date: r.date,
					amount: r.amount,
					category: r.category,
					type: r.type,
					description: r.description,
				}))
			);
			return {
				success: true,
				message: `Replaced all entries with ${rows.length} rows`
			};
		}

		// otherwise append
		await db.insert(transactions).values(
			rows.map(({ date, amount, category, type, description }) => ({
				date,
				amount,
				category,
				type,
				description,
			}))
		);
		return {
			success: true,
			message: `Imported ${rows.length} rows successfully`,
		};
	}
};
