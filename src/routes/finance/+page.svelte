<script lang="ts">
	import { enhance, applyAction, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { type Transaction } from '$lib/server/db/schema';
	import SubmitButton from '$lib/buttons/SubmitButton.svelte';
	import CsvExportButton from '$lib/buttons/CsvExportButton.svelte';
	import CategoryBarChart from '$lib/other/CategoryBarChart.svelte';
	import ForecastSection from '$lib/other/ForecastSection.svelte';
	import { capitalizeFirstLetter } from '$lib/utils/util';
	import {
		type TxType,
		type TransactionCategory,
		EXPENSE_CATEGORIES,
		INCOME_CATEGORIES,
		ALL_CATEGORIES
	} from '$lib/types/finance';
	import { MONTH_NAMES } from '$lib/types/time';
	import fileReport from '$lib/assets/file-report.svg';
	import FlashNotification from '$lib/other/FlashNotification.svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	let { data, form } = $props();
	let transactions = $derived<Transaction[]>(data.transactions ?? []);

	let type = $state<TxType>('expense');
	let date = $state('');
	let search = $state('');
	let category = $state('');
	let chartType = $state<TxType>('expense');
	let categoryFilter = $state<'all' | TransactionCategory>('all');

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

	// for bulk actions
	let bulkMode = $state(false);
	const selectedIds = new SvelteSet<number>();
	// inline editing state mapping
	const drafts = new SvelteMap<number, Transaction>();

	// start edit
	function startEdit(tx: Transaction) {
		if (drafts.has(tx.id)) {
			return;
		}
		drafts.set(tx.id, { ...tx, description: tx.description ?? '' });
	}

	// cancel edit
	function cancelEdit(id: number) {
		drafts.delete(id);
	}

	// set transaction type
	function setDraftType(id: number, newType: TxType) {
		const d = drafts.get(id);
		if (!d) {
			return;
		}
		const categories = newType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
		drafts.set(id, {
			...d,
			type: newType,
			category: categories[0]
		});
	}

	// set category
	function setDraftCategory(id: number, cat: string) {
		const d = drafts.get(id);
		if (!d) {
			return;
		}
		drafts.set(id, { ...d, category: cat });
	}

	$effect(() => {
		if (form?.success && form?.action === 'update') {
			drafts.clear();
		}
		if (form?.success && (form?.action === 'bulkDelete' || form?.deleted)) {
			selectedIds.clear();
			bulkMode = false;
		}
	});

	// bulk mode for selecting multiple transactions
	function toggleBulkMode() {
		bulkMode = !bulkMode;
		if (!bulkMode) {
			selectedIds.clear();
		}
	}

	// toggling selection
	function toggleSelect(id: number) {
		if (selectedIds.has(id)) {
			selectedIds.delete(id);
		} else {
			selectedIds.add(id);
		}
	}

	// selects all
	function selectAll(ids: number[]) {
		ids.forEach((id) => selectedIds.add(id));
	}

	// deselects all
	function deselectAll(ids: number[]) {
		ids.forEach((id) => selectedIds.delete(id));
	}

	// confirmation and deletion of transaction
	async function handleDelete(id: number, msg: string) {
		if (!confirm(msg)) {
			return;
		}
		const body = new FormData();
		body.set('id', String(id));
		const response = await fetch('?/delete', {
			method: 'POST',
			body
		});
		const result = deserialize(await response.text());
		await applyAction(result);
		await invalidateAll();
	}

	// confirmation and deletion of more than one transaction
	async function handleBulkDelete(msg: string) {
		if (!confirm(msg)) {
			return;
		}

		const body = new FormData();
		for (const id of selectedIds) {
			body.append('ids', String(id));
		}
		const response = await fetch('?/bulkDelete', {
			method: 'POST',
			body
		});
		selectedIds.clear();
		bulkMode = false;

		const result = deserialize(await response.text());
		await applyAction(result);
		await invalidateAll();
	}

	// check if any part of the form is modified to determine whether user needs to save again
	function isModified(tx: Transaction, draft: Transaction): boolean {
		return (
			draft.type !== tx.type ||
			draft.category !== tx.category ||
			draft.amount !== tx.amount ||
			draft.date !== tx.date ||
			(draft.description ?? '') !== (tx.description ?? '')
		);
	}

	// filter by keywords and/or selected category
	let filtered = $derived(
		transactions.filter((tx) => {
			if (categoryFilter !== 'all' && tx.category !== categoryFilter) {
				return false;
			}
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

<section class="section-grid-layout">
	<FlashNotification
		flashType={form?.success ? 'success' : 'error'}
		message={form?.message ?? null}
		durationMs={5000}
	/>

	<div class="panel panel--form">
		<h2 class="panel-title">Log transaction</h2>
		<form method="POST" action="?/submit" class="panel--entry-form" use:enhance>
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
				<div class="field-group today-input-btn__field-group">
					<div class="field-label">&nbsp;</div>
					<button type="button" class="today-input-btn" onclick={setToday}> Today</button>
				</div>
			</div>

			<!-- amount -->
			<div class="field-row">
				<label for="amount" class="field-label">Amount</label>
				<div class="inline-amount-wrapper">
					<span class="amount-prefix">$</span>
					<input
						id="amount"
						name="amount"
						type="number"
						step="0.01"
						min="0"
						required
					/>
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
			<!-- search bar -->
			<div class="filters-row">
				<div class="search-wrapper">
					<input
						type="search"
						placeholder="Search by category or description"
						bind:value={search}
					/>
				</div>
				<!-- filter by category -->
				<div class="category-filter">
					<label class="field-label" for="c-filter">Category</label>
					<select id="c-filter" bind:value={categoryFilter}>
						<option value="all">All</option>
						{#each ALL_CATEGORIES as c (c)}
							<option value={c}>{c}</option>
						{/each}
					</select>
				</div>
			</div>
			<!-- bulk mode toggle -->
			<button
				type="button"
				class="bulk-toggle-btn"
				class:bulk-toggle-btn--active={bulkMode}
				onclick={toggleBulkMode}
			>
				{bulkMode ? 'Cancel' : 'Select'}
			</button>
		</div>

		<!-- history section -->
		<div class="history-scroll">
			{#if groupedDates.length === 0}
				<p class="empty-state">No entries yet.</p>
			{:else}
				{#each groupedDates as d (d.toString())}
					{@const groupTxs = groupedByDate[d]}
					{@const groupIds = groupTxs.map((t) => t.id)}
					{@const allGroupSelected = bulkMode && groupIds.every((id) => selectedIds.has(id))}
					<section class="date-group">
						<header class="date-group__header">
							<span class="date-group__date-label">
								{formatDateLabel(d)}
							</span>
							{#if bulkMode}
								<label class="checkbox-label">
									<input
										type="checkbox"
										class="checkbox"
										checked={allGroupSelected}
										onchange={() =>
											allGroupSelected ? deselectAll(groupIds) : selectAll(groupIds)}
									/>
									<span class="checkbox-custom"></span>
								</label>
							{/if}
						</header>
						<!-- transactions list -->
						<ul class="history-list">
							{#each groupedByDate[d] as tx (tx.id)}
								{@const draft = drafts.get(tx.id)}
								{@const isEditing = !!draft}
								{@const formModified = isEditing && isModified(tx, draft)}
								<li
									class="history-item"
									class:history-item--selected={selectedIds.has(tx.id)}
									class:history-item--editing={isEditing}
								>
									<form
										method="POST"
										action="?/update"
										use:enhance
										onsubmit={(e) => {
											if (!draft?.category) {
												e.preventDefault();
												startEdit(tx);
											}
										}}
									>
										<input type="hidden" name="id" value={tx.id} />

										{#if isEditing}
											<!-- full inline edit form where all fields can be edited -->
											<input type="hidden" name="type" value={draft.type} />
											<input type="hidden" name="date" value={draft.date} />
											<input type="hidden" name="category" value={draft.category} />
											<input type="hidden" name="amount" value={draft.amount} />
											<input type="hidden" name="description" value={draft.description ?? ''} />

											<div class="history-item__edit-mode-expanded">
												<!-- type toggle in edit mode -->
												<div class="edit-field-row">
													<span class="edit-label">Type</span>
													<div class="inline-type-toggle">
														<button
															type="button"
															class="inline-type-btn"
															class:inline-type-btn--active={draft.type === 'expense'}
															onclick={() => setDraftType(tx.id, 'expense')}
															>Expense
														</button>
														<button
															type="button"
															class="inline-type-btn"
															class:inline-type-btn--active={draft.type === 'income'}
															onclick={() => setDraftType(tx.id, 'income')}
															>Income
														</button>
													</div>
												</div>

												<!-- category edit field -->
												<div class="edit-field-row">
													<span class="edit-label">Category</span>
													<select
														class="inline-select"
														bind:value={draft.category}
														onchange={(e) => setDraftCategory(tx.id, e.currentTarget.value)}
													>
														{#each draft.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES as cat (cat)}
															<option value={cat}>{cat}</option>
														{/each}
													</select>
												</div>

												<!-- amount edit field -->
												<div class="edit-field-row">
													<span class="edit-label">Amount</span>
													<div class="inline-amount-wrapper">
														<span class="amount-prefix">$</span>
														<input
															type="number"
															step="0.01"
															min="0"
															class="inline-input inline-input--amount"
															value={draft.amount}
															oninput={(e) => {
																const d = drafts.get(tx.id);
																if (d) {
																	drafts.set(tx.id, {
																		...d,
																		amount: Number(e.currentTarget.value)
																	});
																}
															}}
														/>
													</div>
												</div>

												<!-- date edit field -->
												<div class="edit-field-row">
													<span class="edit-label">Date</span>
													<input
														type="date"
														class="inline-input inline-input--date"
														value={draft.date}
														oninput={(e) => {
															const d = drafts.get(tx.id);
															if (d) {
																drafts.set(tx.id, {
																	...d,
																	date: e.currentTarget.value
																});
															}
														}}
													/>
												</div>

												<!-- description edit field -->
												<div class="edit-field-row">
													<span class="edit-label">Details</span>
													<input
														type="text"
														class="inline-input inline-input--description"
														placeholder="Description..."
														value={draft.description ?? ''}
														oninput={(e) => {
															const d = drafts.get(tx.id);
															if (d) {
																drafts.set(tx.id, {
																	...d,
																	description: e.currentTarget.value
																});
															}
														}}
													/>
												</div>

												<!-- form actions -->
												<div class="edit-actions">
													<button
														type="submit"
														class="save-btn"
														class:save-btn--disabled={!formModified}
														disabled={!formModified}
														>Save
													</button>
													<button type="button" class="cancel-btn" onclick={() => cancelEdit(tx.id)}
														>Cancel</button
													>
												</div>
											</div>
										{:else}
											<!-- view mode row -->
											<div class="history-item__row">
												<div class="history-item__main">
													<div class="history-item__main-top">
														<span class="history-item__category">{tx.category}</span>
														<label class="checkbox-label" class:checkbox-label--hidden={!bulkMode}>
															<input
																type="checkbox"
																class="checkbox"
																checked={selectedIds.has(tx.id)}
																onchange={() => toggleSelect(tx.id)}
															/>
															<span class="checkbox-custom"></span>
														</label>
													</div>
													{#if tx.description}
														<span class="history-item__description">{tx.description}</span>
													{/if}
												</div>

												<div class="history-item__actions" class:history-item__actions--hidden={bulkMode}>
													<button
														type="button"
														class="edit-btn"
														class:edit-btn--disabled={isEditing}
														disabled={isEditing}
														onclick={() => startEdit(tx)}>Edit</button
													>
													<button
														type="button"
														class="delete-btn"
														onclick={() => handleDelete(tx.id, 'Delete this transaction?')}
														>Delete
													</button>
												</div>
												<div class="history-item__meta">
													<span class="history-item__type history-item__type--{tx.type}">{tx.type}</span>
													<span class="history-item__amount">
														{tx.type === 'expense' ? '-' : '+'}${tx.amount}
													</span>
													<span class="history-item__date-label">{formatDateLabel(tx.date)}</span>
												</div>
											</div>
										{/if}
									</form>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			{/if}
		</div>

		{#if bulkMode && selectedIds.size > 0}
			<div class="bulk-bar">
				<span class="bulk-bar__count">{selectedIds.size} selected</span>
				<button
					type="button"
					class="delete-btn bulk"
					onclick={() => handleBulkDelete(`Delete ${selectedIds.size} transactions?`)}
				>
					Delete selected
				</button>
			</div>
		{/if}

		<!-- csv export button for downloading transactions as csv file -->
		<CsvExportButton
			label="Export CSV"
			description="Download all transactions as CSV"
			csvContent={transactionsCsv}
			iconPath={fileReport}
			filename={`transactions-${new Date().toISOString().slice(0, 10)}.csv`}
		/>
	</div>

	<!-- display transaction history as a bar chart -->
	<CategoryBarChart
		type={chartType}
		incomeTotals={categoryTotals.income}
		expenseTotals={categoryTotals.expense}
	/>

	<!-- ML predictions section, can be toggled on or off	-->
	<div class="ml-forecast">
		<ForecastSection {transactions} />
	</div>
</section>

<style>
	.form-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.4rem;
	}

	@media (max-width: 840px) {
		.section-grid-layout {
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
</style>
