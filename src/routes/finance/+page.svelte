<script lang="ts">
	import { enhance } from '$app/forms';
	import { type Transaction } from '$lib/server/db/schema';
	import SubmitButton from '$lib/buttons/SubmitButton.svelte';
	import CsvExportButton from '$lib/buttons/CsvExportButton.svelte';
	import CategoryBarChart from '$lib/other/CategoryBarChart.svelte';
	import ForecastSection from '$lib/other/ForecastSection.svelte';
	import { capitalizeFirstLetter } from '$lib/utils/util';
	import { type TxType, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '$lib/types/finance';
	import { MONTH_NAMES } from '$lib/types/time';
	import './type_toggle.css';
	import fileReport from '$lib/assets/file-report.svg';
	import FlashNotification from '$lib/other/FlashNotification.svelte';

	let { data, form } = $props();
	let transactions = $derived<Transaction[]>(data.transactions ?? []);

	let type = $state<TxType>('expense');
	let date = $state('');
	let search = $state('');
	let category = $state('');
	let chartType = $state<TxType>('expense');

	// run once then set to today's date
	$effect(() => {
		if (!date) {
			const d = new Date();
			const yyyy = d.getFullYear();
			const mm = String(d.getMonth() + 1).padStart(2, '0');
			const dd = String(d.getDate()).padStart(2, '0');
			date = `${yyyy}-${mm}-${dd}`;
		}
	});

	function setToday() {
		const d = new Date();
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		date = `${yyyy}-${mm}-${dd}`;
	}

	function handleTypeToggle(newType: TxType) {
		type = newType;
		category = '';
	}

	function formatDateLabel(d: string) {
		const [yyyy, mm, dd] = d.split('-').map(Number);
		if (!yyyy || !mm || !dd) {
			return d;
		}
		const month = MONTH_NAMES[mm - 1] ?? '';
		return `${month} ${dd}, ${yyyy}`;
	}

	// filter by keywords
	let filtered = $derived(
		transactions.filter((tx) => {
			if (!search) {
				return true;
			}
			const q = search.toLowerCase();
			return (
				tx.category.toLowerCase().includes(q) || (tx.description ?? '').toLowerCase().includes(q)
			);
		})
	);

	// group by date
	let groupedByDate = $derived(
		filtered.reduce<Record<string, Transaction[]>>((acc, tx) => {
			// if no date then it's empty
			acc[tx.date] ??= [];
			acc[tx.date].push(tx);
			return acc;
		}, {})
	);

	let groupedDates = $derived(
		Object.keys(groupedByDate)
			// sort dates newest to oldest
			.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
	);

	function confirmDelete(event: Event) {
		if (!confirm('Delete this transaction?')) {
			event.preventDefault();
		}
	}

	// convert existing transactions to csv data
	function buildTransactionsCsv(rows: Transaction[]): string {
		if (!rows.length) {
			return '';
		}

		const headers = ['ID', 'Date', 'Amount', 'Category', 'Type', 'Description'];

		const escape = (value: unknown) => {
			const str = String(value ?? '');
			// if value has comma, quote or newline, wrap in quotes and escape them
			return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
		};

		const dataRows = rows.map((tx) => [
			tx.id,
			tx.date,
			tx.amount,
			tx.category,
			capitalizeFirstLetter(tx.type),
			tx.description ?? ''
		]);

		return [
			// headers
			headers.map(escape).join(','),
			// data
			...dataRows.map((r) => r.map(escape).join(','))
		].join('\n');
	}
	let transactionsCsv = $derived(buildTransactionsCsv(filtered));

	// get category totals for each type
	function getCategoryTotals(transactions: Transaction[]) {
		const income: Record<string, number> = {};
		const expense: Record<string, number> = {};

		for (const tx of transactions as Transaction[]) {
			const bucket = tx.type === 'income' ? income : expense;
			bucket[tx.category] = (bucket[tx.category] ?? 0) + tx.amount;
		}

		return { income, expense };
	}
	let categoryTotals = $derived(getCategoryTotals(filtered));
</script>

<section class="finance-layout">
	<FlashNotification
		flashType={form?.success ? 'success' : 'error'}
		message={form?.message ?? null}
		durationMs={5000}
	/>
	<!--	<div class="flash-container" aria-live="polite" aria-atomic="true">-->
	<!--		{#if showSuccess}-->
	<!--			<p class="flash flash&#45;&#45;success">{form?.message}</p>-->
	<!--		{:else if showError}-->
	<!--			<p class="flash flash&#45;&#45;error">{form?.message}</p>-->
	<!--		{/if}-->
	<!--	</div>-->

	<div class="panel panel--form">
		<h2 class="panel-title">Log transaction</h2>
		<!-- on the form UI -->
		<!--{#if showSuccess}-->
		<!--	<p class="flash flash&#45;&#45;success">{form?.message}</p>-->
		<!--{/if}-->
		<!--{#if showError}-->
		<!--	<p class="flash flash&#45;&#45;error">{form?.message}</p>-->
		<!--{/if}-->

		<form method="POST" action="?/submit" class="entry-form" use:enhance>
			<div class="field-row">
				<div class="field-label">Type</div>
				<div class="type-toggle">
					<button
						type="button"
						class:active={type === 'expense'}
						onclick={() => handleTypeToggle('expense')}
					>
						Expense
					</button>
					<button
						type="button"
						class:active={type === 'income'}
						onclick={() => handleTypeToggle('income')}
					>
						Income
					</button>
				</div>
				<input type="hidden" name="type" value={type} />
			</div>

			<!-- date + today -->
			<div class="field-row field-row--inline">
				<div class="field-group">
					<label for="date" class="field-label">Date</label>
					<input id="date" name="date" type="date" bind:value={date} required />
				</div>
				<div class="field-group field-group--today">
					<div class="field-label">&nbsp;</div>
					<button type="button" class="today-input-btn" onclick={setToday}> Today </button>
				</div>
			</div>

			<!-- amount -->
			<div class="field-row">
				<label for="amount" class="field-label">Amount</label>
				<div class="amount-input-wrapper">
					<span class="amount-prefix">$</span>
					<input id="amount" name="amount" type="number" step="0.01" min="0" required />
				</div>
			</div>

			<!-- category fixed per type -->
			<div class="field-row">
				<label for="category" class="field-label">Category</label>
				<select id="category" name="category" bind:value={category} required>
					<option value="" disabled selected>
						{type === 'expense' ? 'Select expense category' : 'Select income category'}
					</option>

					{#if type === 'expense'}
						{#each EXPENSE_CATEGORIES as category (category.toString())}
							<option value={category}>{category}</option>
						{/each}
					{:else}
						{#each INCOME_CATEGORIES as category (category.toString())}
							<option value={category}>{category}</option>
						{/each}
					{/if}
				</select>
			</div>

			<!-- description, optional field -->
			<div class="field-row">
				<label for="description" class="field-label">Details</label>
				<textarea id="description" name="description" rows="2" placeholder="Description..."
				></textarea>
			</div>

			<div class="form-actions">
				<SubmitButton label="Save entry" />
			</div>
		</form>
	</div>

	<div class="panel panel--history">
		<div class="history-header">
			<h2 class="panel-title">Recent transactions</h2>
			<div class="search-wrapper">
				<input type="search" placeholder="Search by category or description" bind:value={search} />
			</div>
		</div>

		<!-- history section -->
		<div class="history-scroll">
			{#if groupedDates.length === 0}
				<p class="empty-state">No entries yet.</p>
			{:else}
				{#each groupedDates as d (d.toString())}
					<section class="date-group">
						<header class="date-group__header">
							<span class="date-group__date-label">
								{formatDateLabel(d)}
							</span>
						</header>
						<!-- transactions list -->
						<ul class="tx-list">
							{#each groupedByDate[d] as tx (tx.id)}
								<li class="tx-item">
									<div class="tx-row">
										<div class="tx-main">
											<span class="tx-category">{tx.category}</span>
											{#if tx.description}
												<span class="tx-description">{tx.description}</span>
											{/if}
										</div>
										<div class="tx-actions">
											<form method="POST" action="?/delete" use:enhance>
												<input type="hidden" name="id" value={tx.id} />
												<button type="submit" class="delete-btn" onclick={confirmDelete}>
													Delete
												</button>
											</form>
										</div>
										<div class="tx-meta">
											<span class="tx-type tx-type-{tx.type}">
												{tx.type}
											</span>
											<span class="tx-amount">
												{tx.type === 'expense' ? '-' : '+'}{tx.amount}
											</span>
										</div>
									</div>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			{/if}
		</div>
		<CsvExportButton
			label="Export CSV"
			description="Download all transactions as CSV"
			csvContent={transactionsCsv}
			iconPath={fileReport}
			filename={`transactions-${new Date().toISOString().slice(0, 10)}.csv`}
		/>
	</div>

	<div class="history-chart-row">
		<CategoryBarChart
			type={chartType}
			incomeTotals={categoryTotals.income}
			expenseTotals={categoryTotals.expense}
		/>
	</div>

	<div class="ml-forecast">
		<ForecastSection {transactions} />
	</div>
</section>

<!--suppress CssUnusedSymbol
(for the tx-income and tx-expense type css since it relies on a string concat)
-->
<style>
	.finance-layout {
		max-width: 1100px;
		margin: 1.5rem auto;
		padding: 0 1.5rem 2rem;
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.2fr);
		gap: 1.5rem;
	}

	.panel {
		border-radius: 1rem;
		border: 1px solid var(--border);
		background: linear-gradient(145deg, var(--bg-secondary), var(--bg-surface));
		box-shadow:
			0 12px 24px rgba(0, 0, 0, 0.35),
			0 0 0 1px rgba(0, 0, 0, 0.45);
		padding: 1.25rem 1.5rem 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.panel-title {
		margin: 0 0 0.3rem 0;
		font-size: 1.1rem;
		font-weight: 600;
	}

	.panel--form {
		min-height: 0;
		max-height: 550px;
	}

	.panel--history {
		min-height: 360px;
		max-height: 550px;
	}

	.entry-form {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.field-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field-row--inline {
		flex-direction: row;
		gap: 0.8rem;
	}

	.field-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field-group--today {
		align-items: flex-end;
	}

	.field-label {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	input,
	select,
	textarea {
		border-radius: 0.6rem;
		border: 1px solid rgba(190, 212, 233, 0.4);
		padding: 0.45rem 0.6rem;
		background: rgba(12, 30, 52, 0.85);
		color: var(--text-primary);
		font-size: 0.9rem;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: rgba(190, 212, 233, 0.7);
		background: rgba(12, 30, 52, 0.95);
		box-shadow:
			0 0 0 2px rgba(51, 115, 176, 0.3),
			inset 0 0 0 1px rgba(190, 212, 233, 0.5);
		transition: all 0.2s ease;
	}

	.today-input-btn {
		border-radius: 999px;
		border: 1px solid var(--border);
		padding: 0.3rem 0.9rem;
		background: rgba(16, 40, 65, 0.95);
		color: var(--text-primary);
		font-size: 0.8rem;
		cursor: pointer;
		box-shadow:
			0 6px 12px rgba(0, 0, 0, 0.35),
			0 0 0 1px rgba(0, 0, 0, 0.4);
		transition:
			background 0.15s ease,
			box-shadow 0.15s ease,
			transform 0.12s ease;
	}

	.today-input-btn:hover {
		background: var(--accent-hover);
	}

	.amount-input-wrapper {
		display: flex;
		align-items: center;
		border-radius: 0.6rem;
		border: 1px solid rgba(190, 212, 233, 0.4);
		background: rgba(12, 30, 52, 0.85);
		overflow: hidden;
		transition: all 0.2s ease;
	}

	.amount-input-wrapper input {
		border: none;
		border-radius: 0;
		flex: 1;
		padding: 0.45rem 0.6rem 0.45rem 0.5rem;
		background: transparent;
		color: var(--text-primary);
		font-size: 0.9rem;
	}

	.amount-input-wrapper:focus-within {
		border-color: rgba(190, 212, 233, 0.7);
		background: rgba(12, 30, 52, 0.95);
		box-shadow:
			0 0 0 2px rgba(51, 115, 176, 0.3),
			inset 0 0 0 1px rgba(190, 212, 233, 0.5);
	}

	.amount-input-wrapper input:focus {
		outline: none;
		box-shadow: none;
	}

	.amount-prefix {
		padding: 0.45rem 0.7rem;
		font-size: 0.9rem;
		color: var(--text-secondary);
		background: rgba(12, 30, 52, 0.95);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.4rem;
	}

	.history-header {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.search-wrapper input {
		width: 100%;
	}

	.history-scroll {
		margin-top: 0.4rem;
		border-radius: 0.8rem;
		background: rgba(10, 24, 41, 0.9);
		padding: 0.75rem 0.8rem;
		overflow: auto;
		max-height: 360px;
		box-shadow:
			inset 0 0 0 1px rgba(0, 0, 0, 0.5),
			inset 0 0 12px rgba(0, 0, 0, 0.65);
	}

	.empty-state {
		margin: 0.4rem 0;
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	.date-group {
		margin-bottom: 0.9rem;
	}

	.date-group__header {
		position: sticky;
		top: 0;
		z-index: 1;
		margin-bottom: 0.4rem;
		padding: 0.15rem 0.35rem;
		background: linear-gradient(to right, rgba(16, 40, 65, 0.98), rgba(16, 40, 65, 0.8));
		border-radius: 999px;
		display: inline-flex;
		max-width: max-content;
	}

	.date-group__date-label {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.tx-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
	}

	.tx-item {
		border-radius: 0.7rem;
		padding: 0.45rem 0.55rem;
		background: radial-gradient(circle at top left, rgba(51, 115, 176, 0.42), rgba(7, 20, 37, 0.9));
		box-shadow:
			0 6px 14px rgba(0, 0, 0, 0.45),
			0 0 0 1px rgba(0, 0, 0, 0.55);
	}

	.tx-row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 0.75rem 0.5rem;
		align-items: center;
	}

	.tx-main {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.tx-category {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.tx-description {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.tx-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.1rem;
		text-align: right;
		padding-right: 0.5em;
	}

	.tx-type {
		font-size: 0.75rem;
		text-transform: capitalize;
		padding: 0.08rem 0.4rem;
		border-radius: 999px;
		border: 1px solid rgba(190, 212, 233, 0.6);
	}

	.tx-type-income {
		background: rgba(59, 176, 126, 0.25);
	}

	.tx-type-expense {
		background: rgba(214, 88, 95, 0.25);
	}

	.tx-amount {
		font-size: 0.9rem;
		font-weight: 600;
	}

	.tx-actions {
		display: flex;
		justify-content: flex-end;
		opacity: 0;
		transition: opacity 0.2s ease;
	}
	.tx-item:hover .tx-actions {
		opacity: 1;
	}

	.tx-actions form {
		margin: 0;
	}

	.delete-btn {
		background: rgba(214, 88, 95, 0.3);
		border: 1px solid rgba(214, 88, 95, 0.6);
		color: #ffb3c1;
		padding: 0.25rem 0.6rem;
		border-radius: 0.4rem;
		font-size: 0.75rem;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.delete-btn:hover {
		background: rgba(214, 88, 95, 0.5);
	}

	@media (max-width: 840px) {
		.finance-layout {
			grid-template-columns: minmax(0, 1fr);
			max-width: 640px;
		}

		.panel--history {
			max-height: none;
		}

		.history-scroll {
			max-height: 320px;
		}

		.field-row--inline {
			flex-direction: column;
		}
	}

	.ml-forecast {
		border-radius: 1em;
		border: 1px solid var(--border);
		background: radial-gradient(
			circle at top left,
			rgba(51, 115, 176, 0.35),
			rgba(7, 20, 37, 0.98)
		);
		padding: 1.5em;
		box-shadow:
			0 10px 20px rgba(0, 0, 0, 0.4),
			0 0 0 1px rgba(0, 0, 0, 0.55);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
