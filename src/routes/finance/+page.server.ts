import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { transactions, type Transaction } from '$lib/server/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { forecastNextExpense, forecastNextIncome } from '$lib/server/ml/forecasting';

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
	}
};
