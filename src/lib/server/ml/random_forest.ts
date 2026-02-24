import type { Transaction } from '$lib/server/db/schema';

// code and implementation based on: https://machinelearningmastery.com/implement-random-forest-scratch-python/
// coarse mappings and constants
export const COARSE_EXPENSE_MAP: Record<string, string> = {
	Groceries: 'Living',
	Rent: 'Living',
	Dining: 'Leisure',
	Entertainment: 'Leisure',
	Travel: 'Leisure',
	Merchandise: 'Shopping',
	Other: 'Other',
	'Other Services': 'Other'
};

export const COARSE_INCOME_MAP: Record<string, string> = {
	Salary: 'Regular Income',
	Allowance: 'Regular Income',
	Stocks: 'Investments',
	'Interest & Dividends': 'Investments',
	Reimbursements: 'Other Income',
	Gifts: 'Other Income',
	Sales: 'Other Income'
};

// union of both sets then sorted
export const COARSE_CATEGORIES: string[] = [
	...new Set([...Object.values(COARSE_EXPENSE_MAP), ...Object.values(COARSE_INCOME_MAP)])
].sort();
// union of both sets' keys
export const ALL_CATEGORIES: string[] = [
	...new Set([...Object.keys(COARSE_EXPENSE_MAP), ...Object.keys(COARSE_INCOME_MAP)])
];

export const COARSE_TO_ID: Record<string, number> = Object.fromEntries(
	COARSE_CATEGORIES.map((c, i) => [c, i])
);
export const ID_TO_COARSE: Record<number, string> = Object.fromEntries(
	COARSE_CATEGORIES.map((c, i) => [i, c])
);
export const CATEGORY_TO_ID: Record<string, number> = Object.fromEntries(
	ALL_CATEGORIES.map((c, i) => [c, i])
);

// decision tree typings
// row not totally needed but works
type Row = number[];
type Dataset = Row[];
type TreeNode = LeafNode | SplitNode;
type LeafNode = number;
type SplitNode = {
	index: number;
	value: number;
	left: TreeNode;
	right: TreeNode;
};

// split the dataset by a possible split point
function testSplit(index: number, value: number, dataset: Dataset): [Dataset, Dataset] {
	const left: Dataset = [],
		right: Dataset = [];
	for (const row of dataset) {
		(row[index] < value ? left : right).push(row);
	}
	return [left, right];
}

// find purity of class values being separated
function giniIndex(groups: Dataset[], classes: number[]): number {
	const nInstances = groups.reduce((s, g) => s + g.length, 0);
	let gini = 0.0;
	for (const group of groups) {
		const size = group.length;
		if (size === 0) {
			continue;
		}
		let score = 0.0;
		for (const classVal of classes) {
			const p = group.filter((row) => row[row.length - 1] === classVal).length / size;
			score += p * p;
		}
		gini += (1.0 - score) * (size / nInstances);
	}
	return gini;
}

// copy of Python random's randrange
function randrange(n: number): number {
	return Math.floor(Math.random() * n);
}

// find the best split point for a dataset
function getSplit(dataset: Dataset, nFeatures: number): SplitNode {
	const classValues = [...new Set(dataset.map((r) => r[r.length - 1]))];
	let bIndex = 999,
		bValue = 999,
		bScore = 999;
	let bGroups: [Dataset, Dataset] = [[], []];
	const features: number[] = [];
	while (features.length < nFeatures) {
		const index = randrange(dataset[0].length - 1);
		if (!features.includes(index)) {
			features.push(index);
		}
	}
	for (const index of features) {
		for (const row of dataset) {
			const groups = testSplit(index, row[index], dataset);
			const gini = giniIndex(groups, classValues);
			if (gini < bScore) {
				bIndex = index;
				bValue = row[index];
				bScore = gini;
				bGroups = groups;
			}
		}
	}
	// groups are resolved during split, stored temporarily
	return {
		index: bIndex,
		value: bValue,
		left: bGroups[0] as unknown as TreeNode,
		right: bGroups[1] as unknown as TreeNode
	};
}

// create a terminal node value
function toTerminal(group: Dataset): number {
	const outcomes = group.map((row) => row[row.length - 1]);
	// sort by outcomes count
	return outcomes.sort(
		(a, b) => outcomes.filter((v) => v === b).length - outcomes.filter((v) => v === a).length
	)[0];
}

// create sub splits for a node or make terminal
function splitNode(
	node: Partial<SplitNode>,
	maxDepth: number,
	minSize: number,
	nFeatures: number,
	depth: number
): void {
	const left: Dataset = node.left as unknown as Dataset;
	const right: Dataset = node.right as unknown as Dataset;
	delete node.left;
	delete node.right;

	// check for no split
	if (!left.length || !right.length) {
		node.left = node.right = toTerminal([...left, ...right]);
		return;
	}
	// check for max depth
	if (depth >= maxDepth) {
		node.left = toTerminal(left);
		node.right = toTerminal(right);
		return;
	}

	// process left sub
	if (left.length <= minSize) {
		node.left = toTerminal(left);
	} else {
		node.left = getSplit(left, nFeatures);
	}
	if (typeof node.left === 'object') {
		splitNode(node.left, maxDepth, minSize, nFeatures, depth + 1);
	}

	// process right sub
	if (right.length <= minSize) {
		node.right = toTerminal(right);
	} else {
		node.right = getSplit(right, nFeatures);
	}
	if (typeof node.right === 'object') {
		splitNode(node.right, maxDepth, minSize, nFeatures, depth + 1);
	}
}

// build decision tree
function buildTree(train: Dataset, maxDepth: number, minSize: number, nFeatures: number): TreeNode {
	const root: SplitNode = getSplit(train, nFeatures);
	splitNode(root, maxDepth, minSize, nFeatures, 1);
	return root as TreeNode;
}

// predict with decision tree
function treePredict(node: TreeNode, row: Row): number {
	if (typeof node === 'number') {
		return node;
	}
	return row[node.index] < node.value ? treePredict(node.left, row) : treePredict(node.right, row);
}

// create a random subsample from the dataset with replacement
function subsample(dataset: Dataset, ratio: number): Dataset {
	const nSample = Math.round(dataset.length * ratio);
	const sample: Dataset = [];
	while (sample.length < nSample) {
		sample.push(dataset[randrange(dataset.length)]);
	}
	return sample;
}

// make a prediction with a list of bagged trees
function baggingPredict(trees: TreeNode[], row: Row): number {
	const preds = trees.map((t) => treePredict(t, row));
	// sort by prediction count
	return preds.sort(
		(a, b) => preds.filter((v) => v === b).length - preds.filter((v) => v === a).length
	)[0];
}

// mulberry32 seeded shuffle to copy Python's random seed
function seededShuffle<T>(arr: T[], seed: number): T[] {
	const a = [...arr];
	let s = seed;
	for (let i = a.length - 1; i > 0; i--) {
		s = (s ^ (s << 13)) >>> 0;
		s = (s ^ (s >> 17)) >>> 0;
		s = (s ^ (s << 5)) >>> 0;
		const j = s % (i + 1);
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// train test split
export function trainTestSplit<X extends Row>(
	X: X[],
	y: number[],
	testRatio = 0.2,
	randomState = 0
): [X[], X[], number[], number[]] {
	const indices = seededShuffle([...Array(X.length).keys()], randomState);
	const testSize = Math.floor(X.length * testRatio);
	const testIdx = indices.slice(0, testSize);
	const trainIdx = indices.slice(testSize);
	return [
		trainIdx.map((i) => X[i]),
		testIdx.map((i) => X[i]),
		trainIdx.map((i) => y[i]),
		testIdx.map((i) => y[i])
	];
}

// dataset building for transactions
export function buildDatasets(rows: Transaction[]) {
	// expense
	const XExpClf: Row[] = [],
		yExpClf: number[] = [];
	const XExpReg: Row[] = [],
		yExpReg: number[] = [];
	// income
	const XIncClf: Row[] = [],
		yIncClf: number[] = [];
	const XIncReg: Row[] = [],
		yIncReg: number[] = [];

	for (const tr of rows) {
		const { date, amount, category, type } = tr;
		if (!ALL_CATEGORIES.includes(category)) {
			continue;
		}

		// get date features
		const dt = new Date(date);
		// in JS/TS Sunday is 0 but in Python Monday is 0
		const dow = dt.getDay() === 0 ? 6 : dt.getDay() - 1;
		const dom = dt.getDate();
		const month = dt.getMonth() + 1;
		const isWeekend = dow >= 5 ? 1 : 0;
		const isMonthStart = dom <= 3 ? 1 : 0;
		const isMonthEnd = dom >= 28 ? 1 : 0;
		// coarse labeling
		const coarseCat =
			type === 'expense'
				? (COARSE_EXPENSE_MAP[category] ?? 'Other')
				: (COARSE_INCOME_MAP[category] ?? 'Other Income');
		const coarseId = COARSE_TO_ID[coarseCat];
		// fine id
		const fineId = CATEGORY_TO_ID[category];

		if (type === 'expense') {
			// expense
			// for classifier
			XExpClf.push([dow, month, amount, isWeekend, isMonthStart, isMonthEnd]);
			yExpClf.push(coarseId);
			// for regression
			XExpReg.push([dow, month, isWeekend, isMonthStart, fineId]);
			yExpReg.push(amount);
		} else {
			// income
			// for classifier
			XIncClf.push([dow, month, amount, isWeekend, isMonthStart, isMonthEnd]);
			yIncClf.push(coarseId);
			// for regression
			XIncReg.push([dow, month, isWeekend, isMonthStart, fineId]);
			yIncReg.push(amount);
		}
	}
	return { XExpClf, yExpClf, XExpReg, yExpReg, XIncClf, yIncClf, XIncReg, yIncReg };
}

export class RandomForestClassifier {
	private trees: TreeNode[] = [];
	private nFeatures = 0;
	constructor(
		readonly nTrees = 15,
		readonly maxDepth = 10,
		readonly minSize = 2,
		readonly sampleSize = 1.0
	) {}

	fit(X: Row[], y: number[]): void {
		const dataset: Dataset = X.map((x, i) => [...x, y[i]]);
		this.nFeatures = Math.floor(Math.sqrt(X[0].length));
		this.trees = [];
		for (let i = 0; i < this.nTrees; i++) {
			const sample = subsample(dataset, this.sampleSize);
			this.trees.push(buildTree(sample, this.maxDepth, this.minSize, this.nFeatures));
		}
	}

	predictOne(x: Row): number {
		return baggingPredict(this.trees, x);
	}
	predict(X: Row[]): number[] {
		return X.map((x) => this.predictOne(x));
	}
}

export class RandomForestRegressor {
	private trees: TreeNode[] = [];
	private nFeatures = 0;
	constructor(
		readonly nTrees = 15,
		readonly maxDepth = 10,
		readonly minSize = 2,
		readonly sampleSize = 1.0
	) {}

	fit(X: Row[], y: number[]): void {
		const dataset: Dataset = X.map((x, i) => [...x, y[i]]);
		this.nFeatures = Math.floor(Math.sqrt(X[0].length));
		this.trees = [];
		for (let i = 0; i < this.nTrees; i++) {
			const sample = subsample(dataset, this.sampleSize);
			this.trees.push(buildTree(sample, this.maxDepth, this.minSize, this.nFeatures));
		}
	}

	predictOne(x: Row): number {
		const preds = this.trees.map((t) => treePredict(t, x));
		return preds.reduce((a, b) => a + b, 0) / preds.length;
	}
	predict(X: Row[]): number[] {
		// raw version of predicting rows
		// const preds: number[] = [];
		// for (const x of X) {
		// 	const tree_preds: number[] = [];
		// 	for (const t of this.trees) {
		// 		tree_preds.push(treePredict(t, [...x]));
		// 	}
		// 	// sum then divide by tree length then push
		// 	preds.push(tree_preds.reduce((a, b) => a + b, 0) / tree_preds.length);
		// }
		// return preds;
		return X.map((x) => this.predictOne(x));
	}
}
