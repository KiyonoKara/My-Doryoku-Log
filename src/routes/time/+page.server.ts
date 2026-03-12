import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { time_entries, type TimeEntry } from '$lib/server/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { MAX_TASK_LENGTH, TIME_CATEGORIES } from '$lib/types/time';

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
			return fail(405, {
				success: false,
				message: 'Method not allowed'
			});
		}

		const formData = await request.formData();
		const task = formData.get('task');
		const category = formData.get('category');

		if (typeof task !== 'string' || !task.trim()) {
			return fail(400, {
				success: false,
				message: 'Task name required'
			});
		}

		if (task.length > MAX_TASK_LENGTH) {
			return fail(400, {
				success: false,
				message: `Task name cannot be longer than ${MAX_TASK_LENGTH} characters`
			});
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
			return fail(500, {
				success: false,
				message: 'Failed to create timer entry'
			});
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

		const existing = await db.select().from(time_entries).where(eq(time_entries.id, id)).limit(1);

		const entry = existing[0];
		if (!entry) {
			return fail(404, {
				success: false,
				message: 'Entry not found'
			});
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

	update: async ({ request }) => {
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

		const task = formData.get('task');
		const category = formData.get('category');
		const start_date = formData.get('start_date');
		const end_date = formData.get('end_date');
		const duration_ms = formData.get('duration_ms');

		if (typeof task !== 'string' || !task.trim()) {
			return fail(400, {
				success: false,
				message: 'Task name required'
			});
		}

		if (
			typeof category !== 'string' ||
			!(TIME_CATEGORIES as readonly string[]).includes(category.trim())
		) {
			return fail(400, {
				success: false,
				message: 'Invalid category'
			});
		}

		if (typeof start_date !== 'string' || !start_date.trim()) {
			return fail(400, {
				success: false,
				message: 'Start date required'
			});
		}

		const startMs = Date.parse(start_date);
		if (!Number.isFinite(startMs)) {
			return fail(400, {
				success: false,
				message: 'Invalid start date'
			});
		}

		const existing = await db
			.select({ end_date: time_entries.end_date })
			.from(time_entries)
			.where(eq(time_entries.id, id))
			.limit(1);

		const row = existing[0];
		if (!row) {
			return fail(404, {
				success: false,
				message: 'Entry not found'
			});
		}

		// prevent editing a running entry's dates to avoid conflicts
		if (row.end_date == null) {
			return fail(409, {
				success: false,
				message: 'Stop the timer before editing this entry'
			});
		}

		const end_date_val: string | null =
			typeof end_date === 'string' && end_date.trim() ? end_date.trim() : null;
		if (end_date_val !== null && !Number.isFinite(Date.parse(end_date_val))) {
			return fail(400, {
				success: false,
				message: 'Invalid end date'
			});
		}

		// get duration if both dates are provided, otherwise use submitted value
		let duration_ms_val = 0;
		if (end_date_val) {
			const endMs = Date.parse(end_date_val);
			duration_ms_val = Number.isFinite(endMs) ? Math.max(0, endMs - startMs) : 0;
		} else if (duration_ms !== null) {
			const parsed = Number(duration_ms);
			duration_ms_val = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
		}

		await db
			.update(time_entries)
			.set({
				task: task.trim(),
				category: category.trim(),
				start_date: start_date.trim(),
				end_date: end_date_val,
				duration_ms: duration_ms_val
			})
			.where(eq(time_entries.id, id));

		return {
			success: true,
			action: 'update',
			message: 'Entry updated'
		};
	},

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

		const current = await db
			.select({ end_date: time_entries.end_date })
			.from(time_entries)
			.where(eq(time_entries.id, id))
			.limit(1);

		const row = current[0];
		if (!row) {
			return fail(404, {
				success: false,
				message: 'Entry not found'
			});
		}

		if (row.end_date == null) {
			return fail(409, {
				success: false,
				message: 'Stop the timer before deleting'
			});
		}

		await db.delete(time_entries).where(eq(time_entries.id, id));

		return {
			success: true,
			deleted: true,
			message: 'Entry deleted'
		};
	},

	bulkDelete: async ({ request }) => {
		if (request.method !== 'POST') {
			return fail(405, {
				success: false,
				message: 'Method not allowed'
			});
		}

		const formData = await request.formData();
		const rawIds = formData.getAll('ids');
		const ids = rawIds.map(Number).filter((n) => Number.isFinite(n) && n > 0);

		if (ids.length === 0) {
			return fail(400, {
				success: false,
				message: 'No valid IDs provided'
			});
		}

		const toCheck = await db
			.select({ id: time_entries.id, end_date: time_entries.end_date })
			.from(time_entries)
			.where(inArray(time_entries.id, ids));

		if (toCheck.find((r) => r.end_date == null)) {
			return fail(409, {
				success: false,
				message: 'Stop the timer before deleting'
			});
		}

		await db.delete(time_entries).where(inArray(time_entries.id, ids));

		return {
			success: true,
			action: 'bulkDelete',
			message: `${ids.length} entries deleted`
		};
	}
};
