export const TIME_CATEGORIES = [
	'Work',
	'Coding',
	'Study',
	'Exercise',
	'Chores',
	'Errands',
	'Reading',
	'Drawing',
	'Break',
	'Other'
] as const;

export const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

export type TimeCategory = (typeof TIME_CATEGORIES)[number];

export type StartSuccessData = {
	success: true;
	id: number;
	start_date: string;
	message?: string;
};

/**
 * Validates start data
 * @param data
 */
export function isStartData(data: unknown): data is StartSuccessData {
	if (!data || typeof data !== 'object') {
		return false;
	}
	const obj = data as Record<string, unknown>;
	return (
		obj.success === true &&
		typeof obj.id === 'number' &&
		Number.isFinite(obj.id) &&
		typeof obj.start_date === 'string' &&
		obj.start_date.length > 0
	);
}
