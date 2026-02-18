<script lang="ts">
	import { onMount } from 'svelte';
	import type { TxType, FinMLPredictionResponse } from '$lib/types/finance';
	import { type Transaction } from '$lib/server/db/schema';
	import { capitalizeFirstLetter} from '$lib/utils/util';

	const FORECAST_EXP_API_URL = 'http://127.0.0.1:5000/api/finance/forecast-expense';
	const FORECAST_INC_API_URL = 'http://127.0.0.1:5000/api/finance/forecast-income';

	let { transactions } = $props<{ transactions?: Transaction[]; }>();

	let type: TxType = $state('expense');
	let showPredictions = $state(false);
	let isLoading = $state(false);
	let expPrediction: FinMLPredictionResponse = $state({
		success: false,
		n_transactions: 0,
	});
	let incPrediction: FinMLPredictionResponse = $state({
		success: false,
		n_transactions: 0,
	});

	// local counts
	let expenseCount = $derived(transactions.filter((t: Transaction) => t.type === 'expense').length);
	let incomeCount = $derived(transactions.filter((t: Transaction) => t.type === 'income').length);
	let lastExpenseCount = $state<number>(0);
	let lastIncomeCount = $state<number>(0);
	let needsExpenseRefresh = $derived(expenseCount !== lastExpenseCount);
	let needsIncomeRefresh = $derived(incomeCount !== lastIncomeCount);
	let needsRefresh = $derived(needsExpenseRefresh || needsIncomeRefresh);

	async function fetchPrediction(url: string,
																 predType: string,
																 setPrediction: (value: FinMLPredictionResponse) => void) {
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
			lastExpenseCount = expenseCount;
			lastIncomeCount = incomeCount;
		} finally {
			isLoading = false;
		}
	}

	// auto-fetch on mount
	onMount(() => {
		lastExpenseCount = expenseCount;
		lastIncomeCount = incomeCount;
		fetchPredictions();
	});
</script>

<div class="ml-forecast">
	<!-- header and type toggle-->
	<div class="ml-forecast__header">
		<h3>Predictions</h3>
		<span class="ml-forecast__chip">
			{type === 'expense' ? 'Expense' : 'Income'}
		</span>
	</div>
	<div class="type-toggle">
		<button
			type="button"
			class:active={type === 'expense'}
			onclick={() => {
				type = 'expense';
			}}>Expense
		</button
		>
		<button
			type="button"
			class:active={type === 'income'}
			onclick={() => {
				type = 'income';
			}}>Income
		</button
		>
	</div>
	<button
		type="button"
		class="ml-forecast__toggle"
		class:expanded={showPredictions}
		onclick={() => (showPredictions = !showPredictions)}
	>
		{showPredictions ? 'Hide' : 'Show'}
	</button>
	<button
		class="ml-forecast__toggle"
		class:dimmed={!needsRefresh || isLoading}
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


	{#if showPredictions}
		{#if isLoading}
			<div class="ml-forecast__loading">
				<div class="spinner"></div>
				Loading predictions...
			</div>

		{:else if type === 'expense'}
			{#if expenseCount >= 10}
				<!-- show predicted expense if there are at least 10 expense transactions -->
				{#if expPrediction.success && expPrediction.pred}
					<div class="ml-forecast__grid">
						<div class="ml-forecast__card ml-forecast__card--expense">
							<div class="ml-forecast__main">
								<div class="ml-forecast__category">
									{expPrediction.pred.coarse_category || '—'}
								</div>
								<div class="ml-forecast__amount">
									-${expPrediction.pred.amount?.toFixed(2) || '0.00'}
								</div>
							</div>
							<div class="ml-forecast__label">Next expense</div>
						</div>
					</div>
				{:else}
					<div class="ml-forecast__status ml-forecast__status--not-ready">
						Something went wrong...
					</div>
				{/if}
			{:else}
				<!-- show status if insufficient -->
				<div class="ml-forecast__status ml-forecast__status--not-ready">
					Enter {10 - expenseCount} more expenses for predictions
				</div>
			{/if}
		{:else}
			{#if incomeCount >= 10}
				{#if incPrediction.success && incPrediction.pred}
					<!-- show predicted income if there are at least 10 income transactions -->
					<div class="ml-forecast__grid">
						<div class="ml-forecast__card ml-forecast__card--income">
							<div class="ml-forecast__main">
								<div class="ml-forecast__category">
									{incPrediction.pred.coarse_category || '—'}
								</div>
								<div class="ml-forecast__amount">
									+${incPrediction.pred.amount?.toFixed(2) || '0.00'}
								</div>
							</div>
							<div class="ml-forecast__label">Next income</div>
						</div>
					</div>
				{:else}
					<div class="ml-forecast__status ml-forecast__status--not-ready">
						Something went wrong...
					</div>
				{/if}
			{:else}
				<!-- show status if insufficient -->
				<div class="ml-forecast__status ml-forecast__status--not-ready">
					Enter {10 - incomeCount} more income transactions for predictions
				</div>
			{/if}
		{/if}
	{/if}
</div>

<style>
    .ml-forecast__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.4rem;
    }

    .ml-forecast__header h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--text-primary);
    }

    .ml-forecast__chip {
        font-size: 0.75rem;
        padding: 0.12rem 0.6rem;
        border-radius: 999px;
        border: 1px solid var(--border-hover);
        background: rgba(12, 30, 52, 0.95);
        color: var(--text-secondary);
    }

    .ml-forecast__toggle {
        font-size: 0.85rem;
        padding: 0.25rem 0.75rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(12, 30, 52, 0.95);
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.15s ease;
        margin-bottom: 0.7rem;
    }

    .ml-forecast__toggle:hover:not(:disabled) {
        background: var(--accent-hover);
        color: var(--text-primary);
    }

    .ml-forecast__toggle.dimmed {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .ml-forecast__toggle.expanded {
        background: var(--accent);
        color: var(--text-primary);
        border-color: var(--accent);
    }

    .ml-forecast__grid {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr);
        justify-content: center;
        margin: 0 auto;
        max-width: 100%;
        gap: 0.75rem;
    }

    .ml-forecast__card {
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
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45),
        0 0 0 1px rgba(0, 0, 0, 0.55);
    }

    .ml-forecast__card:hover {
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
    }

    .ml-forecast__card--expense {
        border-left: 3px solid rgba(214, 88, 95, 0.9);
    }

    .ml-forecast__card--income {
        border-left: 3px solid rgba(59, 176, 126, 0.9);
    }

    .ml-forecast__main {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
    }

    .ml-forecast__category {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--text-primary);
    }

    .ml-forecast__amount {
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .ml-forecast__label {
        font-size: 0.8rem;
        color: var(--text-secondary);
        text-align: right;
        flex-shrink: 0;
        min-width: 5rem;
    }

    .ml-forecast__status {
        padding: 0.6rem;
        border-radius: 0.6rem;
        font-size: 0.85rem;
        text-align: center;
        margin-top: 0.5rem;
    }

    .ml-forecast__status--not-ready {
        background: rgba(214, 88, 95, 0.15);
        border: 1px solid rgba(214, 88, 95, 0.4);
        color: var(--text-secondary);
    }

    .ml-forecast__loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1.5rem;
        color: var(--text-secondary);
        font-style: italic;
    }

    .spinner {
        width: 1.2rem;
        height: 1.2rem;
        border: 2px solid rgba(190, 212, 233, 0.3);
        border-top: 2px solid var(--accent);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    @media (max-width: 840px) {
        .ml-forecast__grid {
            grid-template-columns: 1fr;
        }
    }
</style>
