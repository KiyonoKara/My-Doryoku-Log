import { describe, it, expect } from 'vitest';
import {
	RandomForestClassifier,
	RandomForestRegressor,
	trainTestSplit,
	COARSE_EXPENSE_MAP,
	COARSE_TO_ID
} from './random_forest';

describe('random_forest.ts', () => {
	// order of features: dow, month, amount, isWeekend, isMonthStart, isMonthEnd
	const mockX = [
		[1, 1, 100, 0, 1, 0],
		[2, 1, 110, 0, 1, 0],
		[3, 1, 120, 0, 1, 0],
		[4, 1, 130, 0, 1, 0],
		[5, 1, 140, 0, 1, 0],
		// weekend
		[6, 1, 400, 1, 1, 0],
		// weekend
		[0, 1, 410, 1, 1, 0],
		[1, 2, 100, 0, 1, 0],
		[2, 2, 110, 0, 1, 0],
		[3, 2, 120, 0, 1, 0]
	];
	const mockY = [0, 0, 0, 0, 0, 1, 1, 0, 0, 0];

	it('trainTestSplit should split data correctly', () => {
		const [X_train, X_test, y_train, y_test] = trainTestSplit(mockX, mockY, 0.2, 42);
		expect(X_train.length).toBe(8);
		expect(X_test.length).toBe(2);
		expect(y_train.length).toBe(8);
		expect(y_test.length).toBe(2);
	});

	it('RandomForestClassifier should fit and predict', () => {
		const clf = new RandomForestClassifier(5, 5, 2, 1.0);
		clf.fit(mockX, mockY);
		const pred = clf.predictOne([6, 1, 400, 1, 1, 0]);
		expect(pred).toBeDefined();
		expect([0, 1]).toContain(pred);
	});

	it('RandomForestRegressor should fit and predict', () => {
		const reg = new RandomForestRegressor(5, 5, 2, 1.0);
		const yReg = [100, 110, 120, 130, 140, 400, 410, 100, 110, 120];
		reg.fit(mockX, yReg);
		const pred = reg.predictOne([6, 1, 400, 1, 1, 0]);
		expect(typeof pred).toBe('number');
		expect(pred).toBeGreaterThan(0);
	});

	it('COARSE_EXPENSE_MAP should have expected categories', () => {
		expect(COARSE_EXPENSE_MAP['Groceries']).toBe('Living');
		expect(COARSE_EXPENSE_MAP['Dining']).toBe('Leisure');
	});

	it('COARSE_TO_ID should map coarse categories to numbers', () => {
		expect(typeof COARSE_TO_ID['Living']).toBe('number');
	});
});
