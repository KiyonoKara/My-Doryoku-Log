import type { HandleServerError } from '@sveltejs/kit';
// adding this to debug packaging issues
export const handleError: HandleServerError = ({ error, event }) => {
	console.error('SvelteKit server error');
	console.error('route:', event.route.id);
	console.error('url:', event.url.toString());
	console.error(error);

	return {
		message: 'Internal Server Error'
	};
};
