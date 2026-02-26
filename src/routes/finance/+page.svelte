<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
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
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

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
		await fetch('?/delete', {
			method: 'POST',
			body
		});
		await invalidateAll();
	}

	// confirmation and deletion of more than one transactions
	async function handleBulkDelete(msg: string) {
		if (!confirm(msg)) {
			return;
		}

		const body = new FormData();
		for (const id of selectedIds) {
			body.append('ids', String(id));
		}
		await fetch('?/bulkDelete', {
			method: 'POST',
			body
		});
		selectedIds.clear();
		bulkMode = false;
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
					<button type="button" class="today-input-btn" onclick={setToday}> Today</button>
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
			<!-- search bar -->
			<div class="search-wrapper">
				<input type="search" placeholder="Search by category or description" bind:value={search} />
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
							<!--{#if bulkMode}-->
							<!--	<input-->
							<!--		type="checkbox"-->
							<!--		class="group-checkbox"-->
							<!--		checked={allGroupSelected}-->
							<!--		onchange={() => allGroupSelected ? deselectAll(groupIds) : selectAll(groupIds)}-->
							<!--	/>-->
							<!--{/if}-->
							{#if bulkMode}
								<label class="tx-checkbox-label">
									<input
										type="checkbox"
										class="tx-checkbox"
										checked={allGroupSelected}
										onchange={() =>
											allGroupSelected ? deselectAll(groupIds) : selectAll(groupIds)}
									/>
									<span class="tx-checkbox-custom"></span>
								</label>
							{/if}
						</header>
						<!-- transactions list -->
						<ul class="tx-list">
							{#each groupedByDate[d] as tx (tx.id)}
								{@const draft = drafts.get(tx.id)}
								{@const isEditing = !!draft}
								{@const formModified = isEditing && isModified(tx, draft)}
								<li
									class="tx-item"
									class:tx-item--selected={selectedIds.has(tx.id)}
									class:tx-item--editing={isEditing}
								>
									<form
										method="POST"
										action="?/update"
										class="tx-edit-form"
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

											<div class="tx-edit-expanded">
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
														<span class="amount-prefix-sm">$</span>
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
											<div class="tx-row">
												<div class="tx-main">
													<div class="tx-main-top">
														<span class="tx-category">{tx.category}</span>
														<label
															class="tx-checkbox-label"
															class:tx-checkbox-label--hidden={!bulkMode}
														>
															<input
																type="checkbox"
																class="tx-checkbox"
																checked={selectedIds.has(tx.id)}
																onchange={() => toggleSelect(tx.id)}
															/>
															<span class="tx-checkbox-custom"></span>
														</label>
													</div>
													{#if tx.description}
														<span class="tx-description">{tx.description}</span>
													{/if}
												</div>

												<div class="tx-actions" class:tx-actions--hidden={bulkMode}>
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
												<div class="tx-meta">
													<span class="tx-type tx-type-{tx.type}">{tx.type}</span>
													<span class="tx-amount">
														{tx.type === 'expense' ? '-' : '+'}${tx.amount}
													</span>
													<span class="tx-date-label">{formatDateLabel(tx.date)}</span>
												</div>
											</div>
										{/if}
									</form>
									<!-- old legacy code -->
									<!--									<div class="tx-row">-->
									<!--										<div class="tx-main">-->
									<!--											<span class="tx-category">{tx.category}</span>-->
									<!--											{#if tx.description}-->
									<!--												<span class="tx-description">{tx.description}</span>-->
									<!--											{/if}-->
									<!--										</div>-->
									<!--										<div class="tx-actions">-->
									<!--											<form method="POST" action="?/delete" use:enhance>-->
									<!--												<input type="hidden" name="id" value={tx.id} />-->
									<!--												<button type="submit" class="delete-btn" onclick={confirmDelete}>-->
									<!--													Delete-->
									<!--												</button>-->
									<!--											</form>-->
									<!--										</div>-->
									<!--										<div class="tx-meta">-->
									<!--											<span class="tx-type tx-type-{tx.type}">-->
									<!--												{tx.type}-->
									<!--											</span>-->
									<!--											<span class="tx-amount">-->
									<!--												{tx.type === 'expense' ? '-' : '+'}{tx.amount}-->
									<!--											</span>-->
									<!--										</div>-->
									<!--									</div>-->
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			{/if}
		</div>

		{#if bulkMode && selectedIds.size > 0}
			<div class="bulk-bar">
				{#each [...selectedIds] as id (id)}
					<!-- track IDs in a set, then bulk delete -->
				{/each}
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
	<div class="history-chart-row">
		<CategoryBarChart
			type={chartType}
			incomeTotals={categoryTotals.income}
			expenseTotals={categoryTotals.expense}
		/>
	</div>

	<!-- ML predictions section, can be toggled on or off	-->
	<div class="ml-forecast">
		<ForecastSection {transactions} />
	</div>
</section>

<style>
	.finance-layout {
		max-width: 1100px;
		margin: 1.5rem auto;
		padding: 0 1.5rem 2rem;
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.2fr);
		gap: 1.5rem;
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

	.history-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
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
		gap: 0.5rem;
	}

	.date-group__date-label {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.group-checkbox {
		width: 14px;
		height: 14px;
		cursor: pointer;
		accent-color: #3373b0;
	}

	.tx-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
	}

	.tx-item {
		position: relative;
		border-radius: 0.7rem;
		padding: 0.45rem 0.55rem;
		background: radial-gradient(circle at top left, rgba(51, 115, 176, 0.42), rgba(7, 20, 37, 0.9));
		box-shadow:
			0 6px 14px rgba(0, 0, 0, 0.45),
			0 0 0 1px rgba(0, 0, 0, 0.55);
		align-items: center;
		gap: 0.5rem;
	}

	.tx-item--selected {
		box-shadow:
			0 0 0 2px rgba(51, 115, 176, 0.7),
			0 6px 14px rgba(0, 0, 0, 0.45);
	}

	.tx-item--editing {
		box-shadow:
			0 0 0 2px rgba(190, 212, 233, 0.35),
			0 6px 14px rgba(0, 0, 0, 0.45);
	}

	.tx-checkbox-label {
		display: inline-flex;
		align-items: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	.tx-checkbox {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
		pointer-events: none;
	}

	.tx-checkbox-custom {
		width: 15px;
		height: 15px;
		border-radius: 4px;
		border: 2px solid rgba(190, 212, 233, 0.35);
		background: rgba(12, 30, 52, 0.6);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			box-shadow 0.15s ease;
		flex-shrink: 0;
	}

	.tx-checkbox-custom::after {
		content: '';
		display: block;
		width: 4px;
		height: 7px;
		border-right: 2px solid #a8d4f0;
		border-bottom: 2px solid #a8d4f0;
		transform: rotate(45deg) translateY(-1px);
		opacity: 0;
		transition: opacity 0.12s ease;
	}

	.tx-checkbox:checked + .tx-checkbox-custom {
		background: rgba(51, 115, 176, 0.45);
		border-color: rgba(190, 212, 233, 0.7);
		box-shadow: 0 0 0 2px rgba(51, 115, 176, 0.25);
	}

	.tx-checkbox:checked + .tx-checkbox-custom::after {
		opacity: 1;
	}

	.tx-checkbox-label:hover .tx-checkbox-custom {
		border-color: rgba(190, 212, 233, 0.6);
		background: rgba(51, 115, 176, 0.2);
	}

	.tx-checkbox-label--hidden {
		visibility: hidden;
	}

	.tx-edit-form {
		min-width: 0;
	}

	.tx-category--editable {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-primary);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		border-bottom: 1px dashed transparent;
		transition: border-color 0.15s;
	}

	.tx-category--editable:hover {
		border-bottom-color: rgba(190, 212, 233, 0.5);
	}

	/* editable description button with dashed lines */
	.tx-description--editable {
		font-size: 0.8rem;
		color: var(--text-secondary);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		border-bottom: 1px dashed transparent;
		transition: border-color 0.15s;
	}

	.tx-description--editable:hover {
		border-bottom-color: rgba(190, 212, 233, 0.4);
	}

	.tx-description--empty {
		color: rgba(190, 212, 233, 0.3);
		font-style: italic;
	}

	/* for the inline inputs */
	.inline-input {
		font-size: 0.85rem;
		padding: 0.2rem 0.4rem;
		border-radius: 0.4rem;
		border: 1px solid rgba(190, 212, 233, 0.5);
		background: rgba(12, 30, 52, 0.9);
		color: var(--text-primary);
	}

	.inline-input--description {
		width: 100%;
	}

	.inline-input--amount {
		width: 80px;
	}

	.inline-input--date {
		font-size: 0.75rem;
	}

	.inline-select {
		font-size: 0.85rem;
		padding: 0.2rem 0.4rem;
		border-radius: 0.4rem;
		border: 1px solid rgba(190, 212, 233, 0.5);
		background: rgba(12, 30, 52, 0.9);
		color: var(--text-primary);
	}

	.inline-type-toggle {
		display: flex;
		gap: 0.2rem;
	}

	.inline-type-btn {
		font-size: 0.7rem;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		border: 1px solid rgba(190, 212, 233, 0.3);
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.inline-type-btn--active {
		background: rgba(51, 115, 176, 0.35);
		border-color: rgba(190, 212, 233, 0.6);
		color: var(--text-primary);
	}

	.inline-type-btn:not(.inline-type-btn--active):hover {
		background: rgba(190, 212, 233, 0.08);
	}

	.inline-amount-wrapper {
		display: flex;
		align-items: center;
		gap: 0.1rem;
	}

	.amount-prefix-sm {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.tx-date-edit {
		font-size: 0.7rem;
		color: rgba(190, 212, 233, 0.5);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		border-bottom: 1px dashed rgba(190, 212, 233, 0.3);
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

	.tx-main-top {
		display: flex;
		align-items: center;
		gap: 0.4rem;
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
		color: var(--text-primary);
	}

	.tx-type-income {
		background: rgba(59, 176, 126, 0.25);
	}

	.tx-type-expense {
		background: rgba(214, 88, 95, 0.25);
	}

	.tx-type:hover {
		filter: brightness(1.3);
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
		flex-direction: column;
		gap: 0.3rem;
	}

	.tx-item:hover .tx-actions {
		opacity: 1;
	}

	.tx-actions--hidden {
		visibility: hidden;
		pointer-events: none;
	}

	.tx-actions .edit-btn,
	.tx-actions .delete-btn {
		width: 100%;
		text-align: center;
		box-sizing: border-box;
	}

	.delete-btn.bulk {
		background: rgba(214, 88, 95, 0.1);
		border: 1px solid rgba(214, 88, 95, 0.9);
		color: #ffb3c1;
	}

	.bulk-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		border-radius: 0.6rem;
		background: rgba(214, 88, 95, 0.12);
		border: 1px solid rgba(214, 88, 95, 0.9);
		margin-top: 0.25rem;
	}

	.bulk-bar__count {
		font-size: 0.85rem;
		color: #ffb3c1;
	}

	.bulk-toggle-btn {
		font-size: 0.78rem;
		padding: 0.25rem 0.75rem;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.bulk-toggle-btn:hover {
		color: var(--text-primary);
		border-color: rgba(190, 212, 233, 0.7);
	}

	.bulk-toggle-btn--active {
		background: rgba(214, 88, 95, 0.15);
		border-color: rgba(214, 88, 95, 0.9);
		color: #ffb3c1;
	}

	.tx-edit-expanded {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.25rem 0;
	}

	.edit-field-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.edit-label {
		font-size: 0.78rem;
		color: var(--text-secondary);
		width: 4.5rem;
		flex-shrink: 0;
	}

	.edit-actions {
		display: flex;
		gap: 0.4rem;
		justify-content: flex-end;
		margin-top: 0.25rem;
	}

	.edit-btn {
		background: rgba(51, 115, 176, 0.2);
		border: 1px solid rgba(51, 115, 176, 0.5);
		color: #a8d4f0;
		padding: 0.25rem 0.6rem;
		border-radius: 0.4rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.edit-btn:hover {
		background: rgba(51, 115, 176, 0.35);
	}

	.edit-btn--disabled {
		opacity: 0.35;
		cursor: not-allowed;
		pointer-events: none;
	}

	.tx-date-label {
		font-size: 0.7rem;
		color: rgba(190, 212, 233, 0.45);
	}

	.save-btn {
		background: rgba(59, 176, 126, 0.25);
		border: 1px solid rgba(59, 176, 126, 0.5);
		color: #a8f0d5;
		padding: 0.25rem 0.55rem;
		border-radius: 0.4rem;
		font-size: 0.75rem;
		cursor: pointer;
		font-weight: 500;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.save-btn:hover {
		background: rgba(59, 176, 126, 0.4);
	}

	.save-btn--disabled {
		opacity: 0.35;
		cursor: not-allowed;
		pointer-events: none;
	}

	.cancel-btn {
		background: rgba(190, 212, 233, 0.08);
		border: 1px solid rgba(190, 212, 233, 0.2);
		color: var(--text-secondary);
		padding: 0.2rem 0.45rem;
		border-radius: 0.4rem;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.cancel-btn:hover {
		background: rgba(190, 212, 233, 0.15);
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
