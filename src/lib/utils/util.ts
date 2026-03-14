import { MONTH_NAMES } from '$lib/types/time';

/**
 * Capitalizes first letter
 * @param str
 */
export function capitalizeFirstLetter(str: string) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

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

export function toYmd(d: Date) {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

export function formatDateLabel(ymd: string) {
	const [yyyy, mm, dd] = ymd.split('-').map(Number);
	if (!yyyy || !mm || !dd) {
		return ymd;
	}
	const month = MONTH_NAMES[mm - 1] ?? '';
	return `${month} ${dd}, ${yyyy}`;
}

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

// for resizing toggle sliders
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

// restrict number input to numbers on input field
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