<script lang="ts">
	import { enhance, applyAction, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import CsvExportButton from '$lib/buttons/CsvExportButton.svelte';
	import CsvImportButton from '$lib/buttons/CsvImportButton.svelte';
	import type { TimeEntry } from '$lib/server/db/schema';
	import fileReport from '$lib/assets/file-report.svg';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		TIME_CATEGORIES,
		MAX_TASK_LENGTH,
		type TimeCategory,
		isStartData
	} from '$lib/types/time';
	import { formatDuration, toYmd, formatDateLabel, formatTime, formatDate } from '$lib/utils/util';
	import FlashNotification from '$lib/other/FlashNotification.svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	let { data, form } = $props();
	let entries = $derived<TimeEntry[]>(data.entries ?? []);

	let taskName = $state('');
	let category = $state<TimeCategory>(TIME_CATEGORIES[0]);

	let search = $state('');
	let categoryFilter = $state<'all' | TimeCategory>('all');

	let isRunning = $state(false);
	let runningId = $state<number | null>(null);
	let runningStartMs = $state<number | null>(null);

	let isPaused = $state(false);
	let accumulatedMs = $state(0);
	let segmentStartMs = $state<number | null>(null);

	let startBusy = $state(false);
	let stopBusy = $state(false);

	let nowMs = $state(Date.now());
	let interval: ReturnType<typeof setInterval> | null = null;

	// tick while a timer is running OR if there's a running entry in DB (refresh-safe)
	let dbRunningEntry = $derived(entries.find((e) => e.end_date == null) ?? null);

	// elapsed time
	let elapsedMs = $derived(
		(() => {
			if (isPaused) {
				return accumulatedMs;
			}
			if (segmentStartMs != null) {
				return accumulatedMs + Math.max(0, nowMs - segmentStartMs);
			}
			// recover data from DB where page/app refreshed or quit mid-run with no pause state
			const dbStart = dbRunningEntry ? Date.parse(dbRunningEntry.start_date) : NaN;
			if (Number.isFinite(dbStart)) {
				return Math.max(0, nowMs - dbStart);
			}
			return 0;
		})()
	);

	function togglePause() {
		if (!isRunning && !dbRunningEntry) {
			return;
		}

		if (isPaused) {
			// resume and start a new segment
			segmentStartMs = Date.now();
			isPaused = false;
		} else {
			// pause by freezing accumulated and clear segment
			if (segmentStartMs != null) {
				accumulatedMs += Math.max(0, Date.now() - segmentStartMs);
			} else if (dbRunningEntry) {
				//pause after a page refresh then get from DB
				accumulatedMs = Math.max(0, Date.now() - Date.parse(dbRunningEntry.start_date));
			}
			segmentStartMs = null;
			isPaused = true;
		}
	}

	// for bulk selecting and deleting
	let bulkMode = $state(false);
	const selectedIds = new SvelteSet<number>();

	// inline editing state mapping
	const drafts = new SvelteMap<number, TimeEntry>();

	// start edit
	function startEdit(entry: TimeEntry) {
		if (drafts.has(entry.id)) {
			return;
		}
		drafts.set(entry.id, { ...entry });
	}

	// cancel edit
	function cancelEdit(id: number) {
		drafts.delete(id);
	}

	// set draft category
	function setDraftCategory(id: number, category: string) {
		const d = drafts.get(id);
		if (!d) {
			return;
		}
		drafts.set(id, { ...d, category: category });
	}

	// check if modified
	function isModified(entry: TimeEntry, draft: TimeEntry): boolean {
		return (
			draft.task !== entry.task ||
			draft.category !== entry.category ||
			draft.start_date !== entry.start_date ||
			draft.end_date !== entry.end_date
		);
	}

	// clear drafts after done
	$effect(() => {
		if (form?.success && form?.action === 'update') {
			drafts.clear();
		}
		if (form?.success && (form?.action === 'bulkDelete' || form?.deleted)) {
			selectedIds.clear();
			bulkMode = false;
		}
	});

	// bulk mode for selecting multiple time entries
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

	// confirmation and deletion of time entry
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

	// confirmation and deletion of more than one time entry
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

	// filter by keywords and/or selected category
	let filtered = $derived(
		entries.filter((e) => {
			if (categoryFilter !== 'all' && e.category !== categoryFilter) {
				return false;
			}
			if (!search) {
				return true;
			}
			const q = search.toLowerCase();
			return e.task.toLowerCase().includes(q) || (e.category ?? '').toLowerCase().includes(q);
		})
	);

	let groupedByDate = $derived(
		filtered.reduce<Record<string, TimeEntry[]>>((acc, e) => {
			const start = new Date(e.start_date);
			const key = Number.isNaN(start.getTime()) ? 'Unknown date' : toYmd(start);
			acc[key] ??= [];
			acc[key].push(e);
			return acc;
		}, {})
	);

	let groupedDates = $derived(
		Object.keys(groupedByDate).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
	);

	function buildEntriesCsv(rows: TimeEntry[]): string {
		if (!rows.length) {
			return '';
		}
		const headers = ['ID', 'Task', 'Category', 'Start', 'End', 'Duration (HH:MM:SS)'];

		const escape = (value: unknown) => {
			const str = String(value ?? '');
			return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
		};

		const dataRows = rows.map((e) => [
			e.id,
			e.task,
			e.category ?? '',
			e.start_date,
			e.end_date ?? '',
			// for CSV, if still running, compute live duration
			e.end_date
				? formatDuration(e.duration_ms ?? 0)
				: formatDuration(Math.max(0, nowMs - Date.parse(e.start_date)))
		]);

		return [headers.map(escape).join(','), ...dataRows.map((r) => r.map(escape).join(','))].join(
			'\n'
		);
	}

	let entriesCsv = $derived(buildEntriesCsv(filtered));

	// enhanced start function
	const enhanceStart: SubmitFunction = () => {
		startBusy = true;
		return async ({ result }) => {
			startBusy = false;

			if (result.type !== 'success') {
				return;
			}

			const data = result.data;
			if (!isStartData(data)) {
				console.error('Start missing id/start_date.', data);
				return;
			}

			runningId = data.id;
			const ms = Date.parse(data.start_date);
			runningStartMs = Number.isFinite(ms) ? ms : Date.now();

			// reset paused state
			accumulatedMs = 0;
			segmentStartMs = runningStartMs;
			isPaused = false;

			isRunning = true;
			nowMs = Date.now();

			// refresh entries from load without reloading the entire page
			await invalidateAll();
		};
	};

	// enhanced stop function
	const enhanceStop: SubmitFunction = () => {
		stopBusy = true;

		return async ({ result }) => {
			stopBusy = false;

			if (result.type !== 'success') {
				await applyAction(result);
				return;
			}

			// reset timer state
			isRunning = false;
			runningId = null;
			runningStartMs = null;
			taskName = '';

			// reset pause state
			isPaused = false;
			accumulatedMs = 0;
			segmentStartMs = null;

			// write result data so the form prop triggers
			await applyAction(result);
			// refresh entries without reloading like the previous function
			await invalidateAll();
		};
	};

	$effect(() => {
		const shouldTick = (isRunning || !!dbRunningEntry) && !isPaused;
		if (!shouldTick) {
			if (interval) {
				clearInterval(interval);
			}
			interval = null;
			return;
		}

		interval = setInterval(() => {
			nowMs = Date.now();
		}, 250);

		return () => {
			if (interval) clearInterval(interval);
			interval = null;
		};
	});
</script>

<section class="section-grid-layout">
	<!-- flash notifications from user actions -->
	<FlashNotification
		flashType={form?.success ? 'success' : 'error'}
		message={form?.message ?? null}
		durationMs={5000}
	/>
	<!--timer form panel -->
	<div class="panel panel--form">
		<h2 class="panel-title">Timer</h2>

		<div class="timer-card">
			<div class="timer-row">
				<div class="panel--entry-form">
					<div class="field-row">
						<label for="task" class="field-label">What are you working on?</label>
						<input
							id="task"
							type="text"
							bind:value={taskName}
							placeholder="e.g., Work, study"
							autocomplete="off"
							maxlength={MAX_TASK_LENGTH}
							disabled={isRunning || !!dbRunningEntry}
							required
						/>
						<div class="char-counter" class:visible={taskName.length > MAX_TASK_LENGTH - 10}>
							{taskName.length}/{MAX_TASK_LENGTH} characters
						</div>
					</div>

					<div class="field-row field-row--inline">
						<div class="field-group">
							<label for="category" class="field-label">Category</label>
							<select id="category" bind:value={category} disabled={isRunning || !!dbRunningEntry}>
								{#each TIME_CATEGORIES as c (c)}
									<option value={c}>{c}</option>
								{/each}
							</select>
						</div>
					</div>
				</div>

				<div class="timer-cta">
					{#if isRunning || dbRunningEntry}
						<!-- pause and resume -->
						<button
							type="button"
							class="timer-btn"
							class:timer-pause={!isPaused}
							class:timer-resume={isPaused}
							onclick={togglePause}
						>
							{isPaused ? 'Resume' : 'Pause'}
						</button>
						<!-- stop -->
						<form method="POST" action="?/stop" use:enhance={enhanceStop}>
							<input type="hidden" name="id" value={runningId ?? dbRunningEntry?.id ?? ''} />
							<button type="submit" class="timer-btn timer-stop" disabled={stopBusy}>
								{stopBusy ? 'Stopping…' : 'Stop'}
							</button>
						</form>
					{:else}
						<form method="POST" action="?/start" use:enhance={enhanceStart}>
							<input type="hidden" name="task" value={taskName.trim()} />
							<input type="hidden" name="category" value={category} />
							<button
								type="submit"
								class="timer-btn timer-start"
								disabled={!taskName.trim() || startBusy}
							>
								{startBusy ? 'Starting…' : 'Start'}
							</button>
						</form>
					{/if}
				</div>
			</div>
			<div class="elapsed-block" aria-live="polite">
				<div class="field-label" id="elapsed-label">Elapsed</div>
				<div
					class="elapsed-box"
					class:elapsed-box--paused={isPaused}
					role="status"
					aria-live="polite"
					aria-labelledby="elapsed-label"
				>
					{formatDuration(elapsedMs)}
				</div>
			</div>
		</div>
	</div>

	<!-- time entry history panel -->
	<div class="panel panel--history">
		<div class="history-header">
			<h2 class="panel-title">History</h2>

			<div class="filters-row">
				<div class="search-wrapper">
					<input type="search" placeholder="Search by task or category" bind:value={search} />
				</div>

				<div class="category-filter">
					<label class="field-label" for="category-filter">Category</label>
					<select id="category-filter" bind:value={categoryFilter}>
						<option value="all">All</option>
						{#each TIME_CATEGORIES as c (c)}
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

		<div class="history-scroll">
			{#if groupedDates.length === 0}
				<p class="empty-state">No entries yet.</p>
			{:else}
				{#each groupedDates as d (d.toString())}
					{@const groupEntries = groupedByDate[d]}
					{@const groupIds = groupEntries.filter((e) => e.end_date != null).map((e) => e.id)}
					{@const allGroupSelected =
						bulkMode && groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id))}
					<section class="date-group">
						<header class="date-group-header">
							<span class="date-group-date-label"
								>{d === 'Unknown date' ? 'Unknown date' : formatDateLabel(d)}</span
							>
							<!-- checkboxes for date groups -->
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

						<ul class="history-list">
							{#each groupedByDate[d] as entry (entry.id)}
								{@const isRowRunning = entry.end_date == null}
								{@const startParsed = Date.parse(entry.start_date)}
								{@const rowLiveMs =
									isRowRunning && Number.isFinite(startParsed)
										? Math.max(0, nowMs - startParsed)
										: (entry.duration_ms ?? 0)}
								<!-- entry editing -->
								{@const draft = drafts.get(entry.id)}
								{@const isEditing = !!draft}
								{@const formModified = isEditing && isModified(entry, draft)}

								<li
									class="history-item"
									class:history-item--selected={selectedIds.has(entry.id)}
									class:history-item--editing={isEditing}
								>
									<form method="POST" action="?/update" use:enhance>
										<input type="hidden" name="id" value={entry.id} />

										{#if isEditing}
											<!-- draft values -->
											<input type="hidden" name="task" value={draft.task} />
											<input type="hidden" name="category" value={draft.category} />
											<input type="hidden" name="start_date" value={draft.start_date} />
											<input type="hidden" name="end_date" value={draft.end_date ?? ''} />
											<input type="hidden" name="duration_ms" value={draft.duration_ms ?? 0} />

											<div class="history-item__edit-mode-expanded">
												<!-- task name edit field -->
												<div class="edit-field-row">
													<span class="edit-label">Task</span>
													<input
														type="text"
														class="inline-input inline-input--description"
														placeholder="Task name"
														value={draft.task}
														maxlength={MAX_TASK_LENGTH}
														oninput={(e) => {
															const d = drafts.get(entry.id);
															if (d) {
																drafts.set(entry.id, {
																	...d,
																	task: e.currentTarget.value
																});
															}
														}}
													/>
													<div
														class="char-counter"
														class:visible={draft.task.length > MAX_TASK_LENGTH - 10}
													>
														{draft.task.length}/{MAX_TASK_LENGTH} characters
													</div>
												</div>

												<!-- category edit field -->
												<div class="edit-field-row">
													<span class="edit-label">Category</span>
													<select
														class="inline-select"
														bind:value={draft.category}
														onchange={(e) => setDraftCategory(entry.id, e.currentTarget.value)}
													>
														{#each TIME_CATEGORIES as c (c)}
															<option value={c}>{c}</option>
														{/each}
													</select>
												</div>

												<!-- start date edit field -->
												<div class="edit-field-row">
													<span class="edit-label">Start</span>
													<input
														type="datetime-local"
														class="inline-input inline-input--date"
														value={draft.start_date ? draft.start_date.slice(0, 16) : ''}
														oninput={(e) => {
															const d = drafts.get(entry.id);
															if (!d) {
																return;
															}
															const iso = e.currentTarget.value
																? new Date(e.currentTarget.value).toISOString()
																: d.start_date;
															drafts.set(entry.id, {
																...d,
																start_date: iso
															});
														}}
													/>
												</div>

												<!-- end date edit field -->
												<div class="edit-field-row">
													<span class="edit-label">End</span>
													<input
														type="datetime-local"
														class="inline-input inline-input--date"
														value={draft.end_date ? draft.end_date.slice(0, 16) : ''}
														oninput={(e) => {
															const d = drafts.get(entry.id);
															if (!d) {
																return;
															}
															const iso = e.currentTarget.value
																? new Date(e.currentTarget.value).toISOString()
																: null;
															drafts.set(entry.id, { ...d, end_date: iso });
														}}
													/>
												</div>

												<!-- edit actions edit field -->
												<div class="edit-actions">
													<button
														type="submit"
														class="save-btn"
														class:save-btn--disabled={!formModified}
														disabled={!formModified}
													>
														Save
													</button>
													<button
														type="button"
														class="cancel-btn"
														onclick={() => cancelEdit(entry.id)}
													>
														Cancel
													</button>
												</div>
											</div>
										{:else}
											<!-- view mode row -->
											<div class="history-item__row">
												<div class="history-item__main">
													<span class="history-item__task">{entry.task}</span>
													<span class="history-item__sub">
														<span class="time-chip">{entry.category ?? 'Uncategorized'}</span>
														<span class="history-item__date-label">
															{formatDate(entry.start_date)}
															{formatTime(entry.start_date)}
															{#if entry.end_date}
																to {formatTime(entry.end_date)}
															{:else}
																(running)
															{/if}
														</span>
													</span>
												</div>

												<div
													class="history-item__actions"
													class:history-item__actions--hidden={bulkMode}
												>
													<button
														type="button"
														class="edit-btn"
														class:edit-btn--disabled={isRowRunning || !!dbRunningEntry}
														disabled={isRowRunning || !!dbRunningEntry}
														onclick={() => startEdit(entry)}
													>
														Edit
													</button>
													<button
														type="button"
														class="delete-btn"
														disabled={isRowRunning || !!dbRunningEntry}
														onclick={() => handleDelete(entry.id, 'Delete this entry?')}
														>Delete
													</button>
												</div>

												<div class="time-meta">
													{#if bulkMode && !isRowRunning}
														<label class="checkbox-label">
															<input
																type="checkbox"
																class="checkbox"
																checked={selectedIds.has(entry.id)}
																onchange={() => toggleSelect(entry.id)}
															/>
															<span class="checkbox-custom"></span>
														</label>
													{/if}
													<!-- shows times for entries that aren't active -->
													<span class="time-duration">
														{#if isRowRunning}
															In progress...
														{:else}
															{formatDuration(rowLiveMs)}
														{/if}
													</span>
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

		<!-- bulk delete bar -->
		{#if bulkMode && selectedIds.size > 0}
			<div class="bulk-bar">
				<span class="bulk-bar__count">{selectedIds.size} selected</span>
				<button
					type="button"
					class="delete-btn bulk"
					onclick={() =>
						handleBulkDelete(
							`Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'entry' : 'entries'}?`
						)}
				>
					Delete selected
				</button>
			</div>
		{/if}

			<div class="action-button-container">
				{#if entriesCsv}
				<CsvExportButton
					label="Export CSV"
					description="Download filtered time entries as CSV"
					csvContent={entriesCsv}
					iconPath={fileReport}
					filename={`time-entries-${new Date().toISOString().slice(0, 10)}.csv`}
				/>
				{/if}
				<CsvImportButton
					formAction="?/importCsv"
				/>
			</div>

	</div>
</section>

<style>
	.timer-card {
		margin-top: 0.4rem;
		border-radius: var(--radius-md);
		background: var(--bg-deep-alt);
		padding: 1rem;
		box-shadow: var(--shadow-inset);
	}

	.timer-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1rem;
		align-items: start;
	}

	.elapsed-block {
		margin-top: 1rem;
		display: grid;
		justify-items: center;
		gap: 0.35rem;
	}

	.elapsed-box {
		width: min(420px, 100%);
		padding: 1rem 1.25rem;
		border-radius: 0.95rem;
		border: 1px solid var(--border-mid);
		background: var(--bg-deep-light);
		box-shadow: var(--shadow-inset-alt);
		font-weight: 800;
		font-size: clamp(2.2rem, 4vw, 3.1rem);
		letter-spacing: 0.04em;
		font-variant-numeric: tabular-nums;
		text-align: center;
		transition:
			border-color 0.25s ease,
			background 0.25s ease,
			color 0.25s ease;
	}

	.elapsed-box--paused {
		border-color: var(--color-pause-border);
		background: rgba(20, 20, 8, 0.2);
		color: var(--color-pause-text);
		box-shadow: var(--shadow-inset-alt);
	}

	.timer-cta {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: flex-end;
		gap: 0.45rem;
		padding-top: 1.45rem;
	}

	.timer-btn {
		padding: 0.65rem 1.25rem;
		min-width: 8.75rem;
		height: 2.75rem;
		border-radius: 0.75rem;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
		border: 1px solid transparent;
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.timer-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.timer-start {
		background: var(--color-save-bg);
		color: var(--color-save-text);
		border-color: var(--color-save-border);
	}

	.timer-pause {
		border-color: var(--color-pause-border);
		background: var(--color-pause-bg);
		color: var(--color-pause-text);
	}

	.timer-pause:hover:not(:disabled) {
		background: var(--color-pause-bg-disabled);
		transform: translateY(-1px);
	}

	.timer-resume {
		background: var(--color-resume-bg);
		color: var(--text-secondary);
		border-color: var(--color-resume-border);
	}

	.timer-resume:hover:not(:disabled) {
		background: var(--color-resume-bg-hover);
		transform: translateY(-1px);
	}

	.timer-start:hover:not(:disabled) {
		background: var(--color-positive-border);
		transform: translateY(-1px);
	}

	.timer-stop {
		background: var(--color-delete-bg);
		color: var(--color-negative-text);
		border-color: var(--color-delete-border);
	}

	.timer-stop:hover:not(:disabled) {
		background: var(--color-negative-border);
		transform: translateY(-1px);
	}

	.time-chip {
		font-size: 0.75rem;
		padding: 0.08rem 0.45rem;
		border-radius: 999px;
		border: 1px solid var(--border-mid);
		background: var(--accent-subtle);
		color: var(--text-primary);
		flex-shrink: 0;
	}

	.time-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		text-align: right;
		padding-right: 0.4rem;
		gap: 0.3rem;
	}

	.time-duration {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
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

		.timer-row {
			grid-template-columns: 1fr;
		}

		.timer-cta {
			padding-top: 0;
			justify-content: flex-start;
		}
	}
</style>
