<script lang="ts">
	import type { TxType } from '$lib/types/finance';
	import { dynamicToggleSlider } from '$lib/utils/util';

	let { type, incomeTotals, expenseTotals } = $props<{
		type: TxType;
		incomeTotals: Record<string, number>;
		expenseTotals: Record<string, number>;
	}>();

	// set initial title
	let title = $derived(type === 'expense' ? 'Spending by category' : 'Income by category');

	// for bar graph
	const barOffset = 50;
	const barTextOffset = 10;

	const width = 420;
	const height = 260;
	const padding = { top: 24, right: 16, bottom: 40, left: 80 };

	const chartWidth = width - padding.left - padding.right;
	const chartHeight = height - padding.top - padding.bottom;

	// get all entries then sort
	function getEntries() {
		const source = type === 'expense' ? expenseTotals : incomeTotals;
		const entries = Object.entries(source) as [string, number][];
		// keep anything greater than 0
		entries.filter(([, v]) => v > 0);
		// sort by second element of each entry
		entries.sort((a, b) => b[1] - a[1]);
		return entries;
	}

	let entries = $derived(getEntries());
	let maxValue = $derived(entries.length ? Math.max(...entries.map(([, v]) => v)) : 0);

	// set middle x val
	function xScale(value: number) {
		if (!maxValue) {
			return 0;
		}
		return (value / maxValue) * chartWidth;
	}

	// set middle y val
	function yScale(index: number) {
		const barHeight = chartHeight / Math.max(entries.length, 3);
		return index * barHeight;
	}

	// bar spacing
	function barHeightPerRow() {
		return (chartHeight / Math.max(entries.length, 3)) * 0.6;
	}
</script>

<div class="grid-card">
	<div class="grid-card__header">
		<h3>{title}</h3>
		<span class="grid-card__chip">
			{type === 'expense' ? 'Expense' : 'Income'}
		</span>
	</div>
	<div class="type-toggle" use:dynamicToggleSlider data-state={type}>
		<button
			type="button"
			class:active={type === 'expense'}
			onclick={() => {
				type = 'expense';
			}}
			>Expense
		</button>
		<button
			type="button"
			class:active={type === 'income'}
			onclick={() => {
				type = 'income';
			}}
			>Income
		</button>
	</div>

	{#if entries.length === 0}
		<p class="category-chart__empty">
			No {type} data yet.
		</p>
	{:else}
		<svg viewBox={`0 0 ${width} ${height}`} class="category-chart__svg">
			<g transform={`translate(${padding.left}, ${padding.top})`}>
				{#each entries as [category, value], i (category)}
					<!-- category labels -->
					<text
						x={-barTextOffset + barOffset}
						y={yScale(i) + barHeightPerRow() / 2}
						text-anchor="end"
						dominant-baseline="central"
						class="category-chart__label"
					>
						{category}
					</text>

					<!-- bars -->
					<rect
						x={barOffset}
						y={yScale(i)}
						width={xScale(value / 1.5)}
						height={barHeightPerRow()}
						rx="6"
						class:type-income={type === 'income'}
						class:type-expense={type === 'expense'}
						class="category-chart__bar"
					/>

					<!-- value of categories -->
					<text
						x={xScale(value) / 1.5 + barTextOffset + barOffset}
						y={yScale(i) + barHeightPerRow() / 2}
						dominant-baseline="central"
						class="category-chart__value"
					>
						{value.toFixed(2)}
					</text>
				{/each}
			</g>
		</svg>
	{/if}
</div>

<style>
	.category-chart__empty {
		margin: 0.4rem 0 0;
		font-size: 0.85rem;
		padding: 1rem;
		color: var(--text-secondary);
	}

	.category-chart__svg {
		display: block;
		max-width: 100%;
		height: auto;
		margin-top: 0.2rem;
	}

	.category-chart__label {
		fill: var(--text-secondary);
		font-size: 0.75rem;
	}

	.category-chart__bar {
		fill: var(--accent);
	}

	.category-chart__bar.type-income {
		fill: var(--color-positive);
	}

	.category-chart__bar.type-expense {
		fill: var(--color-negative);
	}

	.category-chart__value {
		fill: var(--text-primary);
		font-size: 0.75rem;
	}
</style>
