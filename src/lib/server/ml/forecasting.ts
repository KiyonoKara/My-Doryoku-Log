import { db } from '$lib/server/db';
import { transactions } from '$lib/server/db/schema';
import type { Transaction } from '$lib/server/db/schema';
import {
	buildDatasets,
	RandomForestClassifier,
	RandomForestRegressor,
	CATEGORY_TO_ID,
	ID_TO_COARSE,
	ALL_CATEGORIES
} from './random_forest';
import type { TxType } from '$lib/types/finance';

// minimum required rows to train models
const MIN_REQ_TRANSACTIONS = 10;

// load rows from db
async function loadRows(): Promise<Transaction[]> {
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

// gets median (for finding the typical amounts)
function getMedian(nums: number[]): number {
	if (!nums.length) {
		return 0;
	}
	const sorted = [...nums].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function defaultFutureFeatures(trType: TxType, rows: Transaction[]) {
	// feature vector for the next transaction of a given type
	// uses current date and typical amount for that type
	const now = new Date();
	const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
	const dom = now.getDate();
	const month = now.getMonth() + 1;
	const isWeekend = dow >= 5 ? 1 : 0;
	const isMonthStart = dom <= 3 ? 1 : 0;
	const isMonthEnd = dom >= 28 ? 1 : 0;

	// calculate median amount per type from history
	const amounts = rows.filter((r) => r.type === trType).map((r) => r.amount);
	const typicalAmount = getMedian(amounts);
	return {
		dow,
		dom,
		month,
		isWeekend,
		isMonthStart,
		isMonthEnd,
		amount: typicalAmount
	};
}

function forecastNextForType(
	trType: TxType,
	models: ReturnType<typeof trainExpenseModels> & ReturnType<typeof trainIncomeModels>,
	rows: Transaction[]
): Record<string, unknown> {
	// forecast next coarse category and amount for a given type of expense or income
	const { dow, month, amount, isWeekend, isMonthStart, isMonthEnd } = defaultFutureFeatures(
		trType,
		rows
	);

	const clf = trType === 'expense' ? models.exp_clf : models.inc_clf;
	const reg = trType === 'expense' ? models.exp_reg : models.inc_reg;

	if (!clf || !reg) {
		return {};
	}

	const xClf = [dow, month, amount, isWeekend, isMonthStart, isMonthEnd];
	const coarseId = clf.predict([xClf])[0];
	const coarseLabel = ID_TO_COARSE[coarseId];

	// pick most frequent fine category for this type
	const fineCounts: Record<string, number> = {};
	for (const r of rows) {
		if (r.type !== trType || !ALL_CATEGORIES.includes(r.category)) {
			continue;
		}
		// find coarse to match build_datasets
		fineCounts[r.category] = (fineCounts[r.category] ?? 0) + 1;
	}

	const mainFine = Object.entries(fineCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
	// use 0 if nothing
	const fineId = mainFine != null ? (CATEGORY_TO_ID[mainFine] ?? 0) : 0;

	const xReg = [dow, month, isWeekend, isMonthStart, fineId];
	const amountPred = reg.predict([xReg])[0];

	return { type: trType, coarse_category: coarseLabel, amount: amountPred };
}

// forecast result typing
export type ForecastResult = {
	success: boolean;
	n_transactions: number;
	pred: Record<string, unknown>;
};

// both functions load db, train models, get forecasts
export async function forecastNextExpense(): Promise<ForecastResult> {
	const rows = await loadRows();
	const { expense } = rowByType(rows);
	if (rows.length < MIN_REQ_TRANSACTIONS) {
		return {
			success: false,
			n_transactions: expense.length,
			pred: {}
		};
	}
	const models = { ...trainExpenseModels(rows), inc_clf: null, inc_reg: null };
	const pred = forecastNextForType('expense', models, rows);
	return {
		success: true,
		n_transactions: expense.length,
		pred
	};
}

export async function forecastNextIncome(): Promise<ForecastResult> {
	const rows = await loadRows();
	const { income } = rowByType(rows);
	if (rows.length < MIN_REQ_TRANSACTIONS) {
		return {
			success: false,
			n_transactions: income.length,
			pred: {}
		};
	}
	const models = { exp_clf: null, exp_reg: null, ...trainIncomeModels(rows) };
	const pred = forecastNextForType('income', models, rows);
	return {
		success: true,
		n_transactions: income.length,
		pred
	};
}
