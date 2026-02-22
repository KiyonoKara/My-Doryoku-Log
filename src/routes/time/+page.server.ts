import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { time_entries, type TimeEntry } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const rows: TimeEntry[] = await db
		.select()
		.from(time_entries)
		.orderBy(desc(time_entries.start_date), desc(time_entries.id))
		.limit(50);

	return {
		entries: rows
	};
};

export const actions: Actions = {
	start: async ({ request }) => {
		if (request.method !== 'POST') {
			return fail(405, { success: false, message: 'Method not allowed' });
		}

		const formData = await request.formData();
		const task = formData.get('task');
		const category = formData.get('category');

		if (typeof task !== 'string' || !task.trim()) {
			return fail(400, { success: false, message: 'Task name required' });
		}

		const start_date = new Date().toISOString();
		const c =
			typeof category === 'string' && category.trim().length > 0 ? category.trim() : 'Other';

		await db.insert(time_entries).values({
			task: task.trim(),
			category: c,
			start_date: start_date,
			end_date: null,
			duration_ms: 0
		});

		const inserted = await db
			.select({ id: time_entries.id, start_date: time_entries.start_date })
			.from(time_entries)
			.orderBy(desc(time_entries.id))
			.limit(1);

		const row = inserted[0];
		if (!row) {
			return fail(500, { success: false, message: 'Failed to create timer entry' });
		}

		return {
			success: true,
			id: row.id,
			start_date: row.start_date,
			message: 'Timer started'
		};
	},

	stop: async ({ request }) => {
		if (request.method !== 'POST') {
			return fail(405, { success: false, message: 'Method not allowed' });
		}

		const formData = await request.formData();
		const id = Number(formData.get('id'));

		if (!Number.isFinite(id)) {
			return fail(400, { success: false, message: 'Invalid ID' });
		}

		const existing = await db.select().from(time_entries).where(eq(time_entries.id, id)).limit(1);

		const entry = existing[0];
		if (!entry) {
			return fail(404, { success: false, message: 'Entry not found' });
		}

		const end_date = new Date().toISOString();
		const startMs = Date.parse(entry.start_date);
		const endMs = Date.parse(end_date);

		const duration_ms =
			Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(0, endMs - startMs) : 0;

		await db.update(time_entries).set({ end_date, duration_ms }).where(eq(time_entries.id, id));

		return {
			success: true,
			message: 'Timer stopped and entry saved'
		};
	},

	delete: async ({ request }) => {
		if (request.method !== 'POST') {
			return fail(405, { success: false, message: 'Method not allowed' });
		}

		const formData = await request.formData();
		const id = Number(formData.get('id'));

		if (!Number.isFinite(id)) {
			return fail(400, { success: false, message: 'Invalid ID' });
		}

		const current = await db
			.select({ end_date: time_entries.end_date })
			.from(time_entries)
			.where(eq(time_entries.id, id))
			.limit(1);

		const row = current[0];
		if (!row) {
			return fail(404, { success: false, message: 'Entry not found' });
		}

		if (row.end_date == null) {
			return fail(409, { success: false, message: 'Stop the timer before deleting' });
		}

		await db.delete(time_entries).where(eq(time_entries.id, id));

		return {
			success: true,
			message: 'Entry deleted'
		};
	}
};
