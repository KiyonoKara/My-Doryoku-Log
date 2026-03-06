<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import leftArrow from '$lib/assets/left-arrow.svg';
	import type { TxType, FinMLPredictionResponse } from '$lib/types/finance';
	import { type Transaction } from '$lib/server/db/schema';
	import { capitalizeFirstLetter } from '$lib/utils/util';

	const FORECAST_EXP_API_URL = '/finance/forecast-expense';
	const FORECAST_INC_API_URL = '/finance/forecast-income';

	let { transactions } = $props<{ transactions?: Transaction[] }>();

	let type: TxType = $state('expense');
	let showPredictions = $state(false);
	let isLoading = $state(false);
	let expPrediction: FinMLPredictionResponse = $state({
		success: false,
		n_transactions: 0
	});
	let incPrediction: FinMLPredictionResponse = $state({
		success: false,
		n_transactions: 0
	});

	// local counts
	let expenseCount = $derived(transactions.filter((t: Transaction) => t.type === 'expense').length);
	let incomeCount = $derived(transactions.filter((t: Transaction) => t.type === 'income').length);

	function hashTransactions(txs: Transaction[], type: TxType): string {
		return txs
			.filter((t) => t.type === type)
			.map((t) => `${t.id}:${t.amount}:${t.category}:${t.date}`)
			.join(',');
	}

	let expenseHash = $derived(hashTransactions(transactions, 'expense'));
	let incomeHash = $derived(hashTransactions(transactions, 'income'));

	let lastExpenseHash = $state('');
	let lastIncomeHash = $state('');

	let needsExpenseRefresh = $derived(expenseHash !== lastExpenseHash);
	let needsIncomeRefresh = $derived(incomeHash !== lastIncomeHash);

	let needsRefresh = $derived(needsExpenseRefresh || needsIncomeRefresh);

	async function fetchPrediction(
		url: string,
		predType: string,
		setPrediction: (value: FinMLPredictionResponse) => void
	) {
		try {
			const res = await fetch(url);
			const data = (await res.json()) as FinMLPredictionResponse;
			setPrediction(data);
		} catch (e) {
			console.error(`${capitalizeFirstLetter(predType)} prediction failed:`, e);
		}
	}

	// get predictions
	async function fetchPredictions() {
		isLoading = true;
		try {
			await fetchPrediction(FORECAST_EXP_API_URL, 'expense', (value) => (expPrediction = value));
			await fetchPrediction(FORECAST_INC_API_URL, 'income', (value) => (incPrediction = value));
		} catch (e) {
			// preds failed
			console.error('Predictions failed:', e);
		} finally {
			isLoading = false;
		}
	}

	async function refreshPredictions() {
		if (isLoading) {
			return;
		}

		try {
			if (needsExpenseRefresh && needsIncomeRefresh) {
				await fetchPredictions();
			} else if (needsExpenseRefresh) {
				await fetchPrediction(FORECAST_EXP_API_URL, 'expense', (value) => (expPrediction = value));
			} else if (needsIncomeRefresh) {
				await fetchPrediction(FORECAST_INC_API_URL, 'income', (value) => (incPrediction = value));
			} else {
				return;
			}
			lastExpenseHash = expenseHash;
			lastIncomeHash = incomeHash;
		} finally {
			isLoading = false;
		}
	}

	// auto-fetch on mount
	onMount(() => {
		lastExpenseHash = expenseHash;
		lastIncomeHash = incomeHash;
		fetchPredictions();
	});
</script>

<div class="grid-card">
	<!-- header and type toggle-->
	<div class="grid-card__header">
		<h3>Predictions</h3>
		<span class="grid-card__chip">
			{type === 'expense' ? 'Expense' : 'Income'}
		</span>
	</div>
	<div class="forecast-header-row">
		<div class="type-toggle">
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
		<div class="forecast-controls">
			<button
				type="button"
				class="forecast-toggle"
				class:forecast-toggle--active={showPredictions}
				onclick={() => (showPredictions = !showPredictions)}
			>
				{showPredictions ? 'Hide' : 'Show'}
				<img
					src={leftArrow}
					alt=""
					aria-hidden="true"
					class="forecast-toggle__chevron"
					class:flipped={showPredictions}
				/>
			</button>
			<button
				class="forecast-refresh"
				class:forecast-refresh--dimmed={!needsRefresh || isLoading}
				onclick={refreshPredictions}
				disabled={!needsRefresh || isLoading}
				title={needsRefresh ? 'New data available' : 'Up to date'}
			>
				{#if isLoading}
					<span class="spinner"></span> Refreshing...
				{:else}
					Refresh
				{/if}
			</button>
		</div>
	</div>

	{#if showPredictions}
		<div transition:slide={{ duration: 240, easing: cubicOut }} class="forecast-body">
			{#if isLoading}
				<div class="forecast__loading">
					<div class="spinner"></div>
					Loading predictions...
				</div>
			{:else if type === 'expense'}
				{#if expenseCount >= 10}
					<!-- show predicted expense if there are at least 10 expense transactions -->
					{#if expPrediction.success && expPrediction.pred}
						<div class="forecast__grid">
							<div class="forecast__card forecast__card--expense">
								<div class="forecast__main">
									<div class="forecast__category">
										{expPrediction.pred.coarse_category || '—'}
									</div>
									<div class="forecast__amount">
										-${expPrediction.pred.amount?.toFixed(2) || '0.00'}
									</div>
								</div>
								<div class="forecast__label">Next expense</div>
							</div>
						</div>
					{:else}
						<div class="forecast__status forecast__status--not-ready">Something went wrong...</div>
					{/if}
				{:else}
					<!-- show status if insufficient -->
					<div class="forecast__status forecast__status--not-ready">
						Enter {10 - expenseCount} more expenses for predictions
					</div>
				{/if}
			{:else if incomeCount >= 10}
				{#if incPrediction.success && incPrediction.pred}
					<!-- show predicted income if there are at least 10 income transactions -->
					<div class="forecast__grid">
						<div class="forecast__card forecast__card--income">
							<div class="forecast__main">
								<div class="forecast__category">
									{incPrediction.pred.coarse_category || '—'}
								</div>
								<div class="forecast__amount">
									+${incPrediction.pred.amount?.toFixed(2) || '0.00'}
								</div>
							</div>
							<div class="forecast__label">Next income</div>
						</div>
					</div>
				{:else}
					<div class="forecast__status forecast__status--not-ready">Something went wrong...</div>
				{/if}
			{:else}
				<!-- show status if insufficient -->
				<div class="forecast__status forecast__status--not-ready">
					Enter {10 - incomeCount} more income transactions for predictions
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.forecast-header-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.forecast-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.forecast-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.3rem 0.85rem;
		border-radius: var(--radius-pill);
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--bg-deep) 75%, var(--bg-surface) 30%);
		color: var(--text-secondary);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background var(--transition-base),
			border-color var(--transition-base),
			color var(--transition-base);
	}

	.forecast-toggle:hover {
		background: var(--bg-raised);
		color: var(--text-primary);
		border-color: var(--border-mid);
	}

	.forecast-toggle--active {
		background: var(--accent);
		color: var(--text-primary);
		border-color: var(--accent);
	}

	.forecast-toggle__chevron {
		width: 14px;
		height: 14px;
		display: inline-block;
		margin-left: 0.35rem;
		flex-shrink: 0;
		opacity: 0.75;
		transform: rotate(270deg);
		transition: transform var(--transition-base);
		filter: brightness(0) saturate(100%) invert(75%) sepia(30%) saturate(500%) hue-rotate(185deg)
			brightness(110%);
	}

	.forecast-toggle__chevron.flipped {
		transform: rotate(90deg);
	}

	.forecast-refresh {
		width: auto;
		height: auto;
		padding: 0.3rem 0.85rem;
		border-radius: var(--radius-pill);
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--bg-deep) 75%, var(--bg-surface) 30%);
		color: var(--text-secondary);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		transition:
			background var(--transition-fast),
			color var(--transition-fast);
	}

	.forecast-refresh:hover:not(:disabled) {
		background: var(--bg-raised);
		color: var(--text-primary);
	}

	.forecast-refresh--dimmed {
		opacity: 0.38;
		cursor: not-allowed;
	}

	.forecast-body {
		margin-top: 0.5rem;
	}

	.forecast__grid {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr);
		margin: 0 auto;
		max-width: 100%;
		gap: 0.75rem;
	}

	.forecast__card {
		margin-top: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(190, 212, 233, 0.3);
		background: rgba(12, 30, 52, 0.9);
		transition: all 0.2s ease;
		cursor: pointer;
		width: 100%;
		box-shadow: var(--shadow-3);
	}

	.forecast__card:hover {
		box-shadow: var(--shadow-3);
	}

	.forecast__card--expense {
		border-left: 3px solid var(--color-negative);
	}

	.forecast__card--income {
		border-left: 3px solid var(--color-positive);
	}

	.forecast__main {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.forecast__category {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.forecast__amount {
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.forecast__label {
		font-size: 0.8rem;
		color: var(--text-secondary);
		text-align: right;
		flex-shrink: 0;
		min-width: 5rem;
	}

	.forecast__status {
		padding: 0.6rem;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		text-align: center;
		margin-top: 0.5rem;
	}

	.forecast__status--not-ready {
		background: var(--color-negative-bg);
		border: 1px solid var(--color-negative-border);
		color: var(--color-negative-text);
	}

	.forecast__loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1.5rem;
		color: var(--text-secondary);
		font-style: italic;
	}

	@media (max-width: 840px) {
		.forecast__grid {
			grid-template-columns: 1fr;
		}
	}
</style>
