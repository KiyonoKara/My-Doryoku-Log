import { integer, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';

export const transactions = sqliteTable('transactions', {
	id: integer('id').primaryKey(),
	date: text('date').notNull(),
	amount: real('amount').notNull(),
	category: text('category').notNull(),
	type: text('type', { enum: ['income', 'expense'] as const }).notNull(),
	description: text('description')
});
