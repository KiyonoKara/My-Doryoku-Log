import { MONTH_NAMES } from '$lib/types/time';

/**
 * Capitalizes the first letter
 * @param str
 */
export function capitalizeFirstLetter(str: string) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format duration in HH:MM:SS format
 * @param ms
 */
export function formatDuration(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0) {
		ms = 0;
	}

	const secs = Math.floor(ms / 1000);
	const mins = Math.floor(secs / 60);
	const hours = Math.floor(mins / 60);

	return `${hours.toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}:${(
		secs % 60
	)
		.toString()
		.padStart(2, '0')}`;
}

/**
 * Format date as YYYY-MM-DD
 * @param d
 */
export function toYmd(d: Date) {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format date as month name, day, year
 * @param ymd
 */
export function formatDateLabel(ymd: string) {
	const [yyyy, mm, dd] = ymd.split('-').map(Number);
	if (!yyyy || !mm || !dd) {
		return ymd;
	}
	const month = MONTH_NAMES[mm - 1] ?? '';
	return `${month} ${dd}, ${yyyy}`;
}

/**
 * Format date as HH:MM
 * @param d
 */
export function formatTime(d: string | null | undefined) {
	if (!d) {
		return '';
	}
	const t = new Date(d);
	if (Number.isNaN(t.getTime())) {
		return '';
	}
	return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format date as MM/DD/YYYY
 * @param d
 */
export function formatDate(d: string | null | undefined) {
	if (!d) {
		return '';
	}
	const t = new Date(d);
	if (Number.isNaN(t.getTime())) {
		return '';
	}
	return t.toLocaleDateString();
}

/**
 * Convert HH:MM:SS formatted date into milliseconds
 * @param s Date string
 */
export function parseDurationHMS(s: string): number {
	if (!s) {
		return 0;
	}
	const parts = s.split(':').map(Number);
	// any negative number automatically makes the duration 0
	if (parts.some(n => n < 0)) {
		return 0;
	}
	if (parts.length === 3) {
		return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
	}
	return 0;
}

/**
 * Dynamic toggle slider that resizes based on the active button
 * @param node
 */
export function dynamicToggleSlider(node: HTMLElement) {
	const updateSlider = () => {
		const buttons = node.querySelectorAll('button');
		const activeIndex = Array.from(buttons).findIndex((btn) => btn.classList.contains('active'));
		if (activeIndex === -1) {
			return;
		}

		const activeBtn = buttons[activeIndex] as HTMLElement;
		const containerRect = node.getBoundingClientRect();
		const btnRect = activeBtn.getBoundingClientRect();

		node.style.setProperty('--pill-w', `${btnRect.width}px`);
		node.style.setProperty('--pill-l', `${btnRect.left - containerRect.left - 1}px`);
	};

	// resize
	updateSlider();
	new ResizeObserver(updateSlider).observe(node);
	new ResizeObserver(updateSlider).observe(node.querySelector('button.active')!);

	// listen for type changes
	const handleTypeChange = () => setTimeout(updateSlider, 10);
	node.addEventListener('click', handleTypeChange);
}

/**
 * Number input validator that only allows numbers and a single decimal point
 * @param e
 */
export function numValidator(e: KeyboardEvent) {
	const input = e.currentTarget as HTMLInputElement;
	if (e.key.length > 1) {
		return;
	}

	if (!/^\d*\.?\d*$/.test(e.key)) {
		return e.preventDefault();
	}

	if (e.key === '.' && input.value.includes('.')) {
		return e.preventDefault();
	}
}

/**
 * Parse CSV line into an array of strings
 * @param line
 */
export function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let cur = '';
	let inQ = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQ) {
			if (ch === '"' && line[i + 1] === '"') {
				cur += '"';
				i++;
			} else if (ch === '"') {
				inQ = false;
			} else {
				cur += ch;
			}
		} else {
			if (ch === '"') {
				inQ = true;
			} else if (ch === ',') {
				result.push(cur);
				cur = '';
			} else {
				cur += ch;
			}
		}
	}
	result.push(cur);
	return result;
}
