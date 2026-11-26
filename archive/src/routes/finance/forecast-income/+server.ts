import { type RequestHandler, json } from '@sveltejs/kit';
import { forecastNextIncome } from '$lib/server/ml/forecasting';

export const GET: RequestHandler = async () => {
	const result = await forecastNextIncome();
	return json(result);
};
