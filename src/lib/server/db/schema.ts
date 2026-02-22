import { integer, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';

export const transactions = sqliteTable('transactions', {
	id: integer('id').primaryKey(),
	date: text('date').notNull(),
	amount: real('amount').notNull(),
	category: text('category').notNull(),
	type: text('type', { enum: ['income', 'expense'] as const }).notNull(),
	description: text('description')
});

export type Transaction = {
	id: number;
	date: string;
	amount: number;
	category: string;
	type: 'income' | 'expense';
	description: string | null;
};

export const time_entries = sqliteTable('time_entries', {
	id: integer('id').primaryKey(),
	task: text('task').notNull(),
	category: text('category').notNull().default('Other'),
	start_date: text('start_date').notNull(),
	end_date: text('end_date'),
	duration_ms: integer('duration_ms').notNull().default(0)
});

export type TimeEntry = {
	id: number;
	task: string;
	category: string;
	start_date: string;
	end_date: string | null;
	duration_ms: number;
};
