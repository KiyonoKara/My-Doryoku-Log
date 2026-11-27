import { type RequestHandler, json } from '@sveltejs/kit';
import { forecastNextExpense } from '$lib/server/ml/forecasting';

export const GET: RequestHandler = async () => {
	const result = await forecastNextExpense();
	return json(result);
};
