<script lang="ts">
	import { onMount } from 'svelte';
	import type { TxType, FinMLPredictionResponse } from '$lib/types/finance';
	const FORECAST_API_URL = 'http://127.0.0.1:5000/api/finance/forecast';

	let type: TxType = 'expense';

	let showPredictions = false;

	let predictions: FinMLPredictionResponse = {
		n_transactions: 0,
		preds: {},
		success: false
	};
	let isLoading = false;

	// get predictions
	async function fetchPredictions() {
		isLoading = true;
		try {
			const res = await fetch(FORECAST_API_URL);
			predictions = await res.json() as FinMLPredictionResponse;
		} catch (e) {
			console.error('Predictions failed:', e);
			predictions = {
				success: false,
				n_transactions: 0,
				preds: {}
			};
		} finally {
			isLoading = false;
		}
	}

	// auto-fetch on mount
	onMount(fetchPredictions);
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
			}}>Expense</button
		>
		<button
			type="button"
			class:active={type === 'income'}
			onclick={() => {
				type = 'income';
			}}>Income</button
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

	{#if showPredictions}
		<!-- if less than 10 transactions, don't show predictions -->
		{#if !predictions.success}
			<div class="ml-forecast__status ml-forecast__status--not-ready">
				Enter {10 - (predictions.n_transactions || 0)} more transactions for
				predictions
			</div>

<!-- if there are 10 more, show it -->
		{:else if predictions.success}
		{#if isLoading}
			<div class="ml-forecast__loading">
				<div class="spinner"></div>
				Loading predictions...
			</div>
		{:else if predictions}
			{#if predictions.preds?.expense || predictions.preds?.income}
				<div class="ml-forecast__grid">
					{#if type === 'expense'}
						<!-- expense card -->
						<div class="ml-forecast__card ml-forecast__card--expense">
							<div class="ml-forecast__main">
								<div class="ml-forecast__category">
									{predictions.preds.expense?.['coarse_category'] || '—'}
								</div>
								<div class="ml-forecast__amount">
									-${predictions.preds.expense?.amount?.toFixed(2) || '0.00'}
								</div>
							</div>
							<div class="ml-forecast__label">Next expense</div>
						</div>
					{:else}
						<!-- income card -->
						<div class="ml-forecast__card ml-forecast__card--income">
							<div class="ml-forecast__main">
								<div class="ml-forecast__category">
									{predictions.preds.income?.['coarse_category'] || '—'}
								</div>
								<div class="ml-forecast__amount">
									+${predictions.preds.income?.amount?.toFixed(2) || '0.00'}
								</div>
							</div>
							<div class="ml-forecast__label">Next income</div>
						</div>
					{/if}
				</div>
			{/if}
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
        box-shadow:
                0 6px 14px rgba(0, 0, 0, 0.45),
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
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    @media (max-width: 840px) {
        .ml-forecast__grid {
            grid-template-columns: 1fr;
        }
    }
</style>