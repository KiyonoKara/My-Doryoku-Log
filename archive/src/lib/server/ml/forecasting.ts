import { getDb } from '$lib/server/db';
import { transactions } from '$lib/server/db/schema';
import type { Transaction } from '$lib/server/db/schema';
import {
	buildDatasets,
	RandomForestClassifier,
	RandomForestRegressor,
	ID_TO_COARSE
} from './random_forest';
import { MIN_REQ_TRANSACTIONS, type TxType } from '$lib/types/finance';

// load rows from db
async function loadRows(): Promise<Transaction[]> {
	const db = getDb();
	return db.select().from(transactions).all();
}

// separate rows by type
function rowByType(rows: Transaction[]): { expense: Transaction[]; income: Transaction[] } {
	return {
		expense: rows.filter((r) => r.type === 'expense'),
		income: rows.filter((r) => r.type === 'income')
	};
}

// trans given classification or regression Random Forest model
function trainRfFinanceModel<T extends RandomForestClassifier | RandomForestRegressor>(
	ModelClass: new () => T,
	X: number[][],
	y: number[]
): T | null {
	if (X.length < MIN_REQ_TRANSACTIONS) {
		return null;
	}
	const m = new ModelClass();
	m.fit(X, y);
	return m;
}

// train separate model for expense classification and regression
function trainExpenseModels(rows: Transaction[]) {
	const { XExpClf, yExpClf, XExpReg, yExpReg } = buildDatasets(rows);
	return {
		exp_clf: trainRfFinanceModel(RandomForestClassifier, XExpClf, yExpClf),
		exp_reg: trainRfFinanceModel(RandomForestRegressor, XExpReg, yExpReg)
	};
}

// train separate model for income classification and regression
function trainIncomeModels(rows: Transaction[]) {
	const { XIncClf, yIncClf, XIncReg, yIncReg } = buildDatasets(rows);
	return {
		inc_clf: trainRfFinanceModel(RandomForestClassifier, XIncClf, yIncClf),
		inc_reg: trainRfFinanceModel(RandomForestRegressor, XIncReg, yIncReg)
	};
}

// date features
export function futureDateFeatures(now: Date) {
	const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
	const dom = now.getDate();
	const month = now.getMonth() + 1;

	return {
		dow,
		month,
		isWeekend: dow >= 5 ? 1 : 0,
		isMonthStart: dom <= 3 ? 1 : 0,
		isMonthEnd: dom >= 28 ? 1 : 0
	};
}

// forecast the coarse category and amount for a given type, null when that type never had enough rows
function forecastNextForType(
	trType: TxType,
	models: ReturnType<typeof trainExpenseModels> & ReturnType<typeof trainIncomeModels>
): Record<string, unknown> | null {
	const clf = trType === 'expense' ? models.exp_clf : models.inc_clf;
	const reg = trType === 'expense' ? models.exp_reg : models.inc_reg;

	if (!clf || !reg) {
		return null;
	}

	const { dow, month, isWeekend, isMonthStart, isMonthEnd } = futureDateFeatures(new Date());

	// both vectors match what buildDatasets produces so no feature is ever unseen
	const xClf = [dow, month, isWeekend, isMonthStart, isMonthEnd];
	const coarseId = clf.predict([xClf])[0];
	const amountPred = reg.predict([[dow, month, isWeekend, isMonthStart, coarseId]])[0];

	return {
		type: trType,
		coarse_category: ID_TO_COARSE[coarseId],
		amount: amountPred
	};
}

// forecast result typing
export type ForecastResult = {
	success: boolean;
	n_transactions: number;
	pred: Record<string, unknown>;
};

// rows keep the models testable without opening the database, falling back to the whole table
export async function forecastNextExpense(rows?: Transaction[]): Promise<ForecastResult> {
	const all = rows ?? (await loadRows());
	const { expense } = rowByType(all);
	const models = { ...trainExpenseModels(all), inc_clf: null, inc_reg: null };
	// success is defined by whether the model was trained instead of getting the row count
	const pred = forecastNextForType('expense', models);

	if (!pred) {
		return { success: false, n_transactions: expense.length, pred: {} };
	}

	return { success: true, n_transactions: expense.length, pred };
}

export async function forecastNextIncome(rows?: Transaction[]): Promise<ForecastResult> {
	const all = rows ?? (await loadRows());
	const { income } = rowByType(all);
	const models = { exp_clf: null, exp_reg: null, ...trainIncomeModels(all) };
	const pred = forecastNextForType('income', models);

	if (!pred) {
		return { success: false, n_transactions: income.length, pred: {} };
	}

	return { success: true, n_transactions: income.length, pred };
}
