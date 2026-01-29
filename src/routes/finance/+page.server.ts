import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { transactions, type Transaction } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

// load page with this
export const load: PageServerLoad = async () => {
	const rows: Transaction[] = await db
		.select()
		.from(transactions)
		.orderBy(desc(transactions.date))
		.limit(50);

	return {
		transactions: rows
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
	}
};
