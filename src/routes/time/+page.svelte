<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import CsvExportButton from '$lib/buttons/CsvExportButton.svelte';
	import type { TimeEntry } from '$lib/server/db/schema';
	import fileReport from '$lib/assets/file-report.svg';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { TIME_CATEGORIES, type TimeCategory, isStartData } from '$lib/types/time';
	import { formatDuration, toYmd, formatDateLabel, formatTime, formatDate } from '$lib/utils/util';
	import FlashNotification from '$lib/other/FlashNotification.svelte';

	let { data, form } = $props();
	let entries = $derived<TimeEntry[]>(data.entries ?? []);

	let taskName = $state('');
	let category = $state<TimeCategory>(TIME_CATEGORIES[0]);

	let search = $state('');
	let categoryFilter = $state<'all' | TimeCategory>('all');

	let isRunning = $state(false);
	let runningId = $state<number | null>(null);
	let runningStartMs = $state<number | null>(null);

	let startBusy = $state(false);
	let stopBusy = $state(false);

	let nowMs = $state(Date.now());
	let interval: ReturnType<typeof setInterval> | null = null;

	// tick while a timer is running OR if there's a running entry in DB (refresh-safe)
	let dbRunningEntry = $derived(entries.find((e) => e.end_date == null) ?? null);

	let effectiveRunningStartMs = $derived(
		runningStartMs && Number.isFinite(runningStartMs)
			? runningStartMs
			: dbRunningEntry && Number.isFinite(Date.parse(dbRunningEntry.start_date))
				? Date.parse(dbRunningEntry.start_date)
				: null
	);

	let elapsedMs = $derived(
		effectiveRunningStartMs != null ? Math.max(0, nowMs - effectiveRunningStartMs) : 0
	);

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

	function confirmDelete(event: Event) {
		if (!confirm('Delete this entry?')) {
			event.preventDefault();
		}
	}

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
				console.error(
					'Start missing id/start_date. Fix +page.server.ts start to return them.',
					data
				);
				return;
			}

			runningId = data.id;

			const ms = Date.parse(data.start_date);
			runningStartMs = Number.isFinite(ms) ? ms : Date.now();

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

			isRunning = false;
			runningId = null;
			runningStartMs = null;
			taskName = '';

			// write result data so the form prop triggers
			await applyAction(result);
			// refresh entries without reloading like the previous function
			await invalidateAll();
		};
	};

	$effect(() => {
		const shouldTick = isRunning || !!dbRunningEntry;
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

	// live tracking
	$effect(() => {
		const hasStart = effectiveRunningStartMs != null;

		if (!hasStart) {
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
			if (interval) {
				clearInterval(interval);
			}
			interval = null;
		};
	});
</script>

<section class="time-layout">
	<!-- flash notifications from user actions -->
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
		<h2 class="panel-title">Timer</h2>

		<div class="timer-card">
			<div class="timer-row">
				<div class="timer-fields">
					<div class="field-row">
						<label for="task" class="field-label">What are you working on?</label>
						<input
							id="task"
							type="text"
							bind:value={taskName}
							placeholder="e.g., Work, study"
							autocomplete="off"
							disabled={isRunning || !!dbRunningEntry}
						/>
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
				<div class="elapsed-box" role="status" aria-live="polite" aria-labelledby="elapsed-label">
					{formatDuration(elapsedMs)}
				</div>
			</div>
		</div>
	</div>

	<div class="panel panel--history">
		<div class="history-header">
			<h2 class="panel-title">History</h2>

			<div class="filters-row">
				<div class="search-wrapper">
					<input type="search" placeholder="Search by task or category" bind:value={search} />
				</div>

				<div class="category-filter">
					<label class="field-label" for="catFilter">Category</label>
					<select id="catFilter" bind:value={categoryFilter}>
						<option value="all">All</option>
						{#each TIME_CATEGORIES as c (c)}
							<option value={c}>{c}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>

		<div class="history-scroll">
			{#if groupedDates.length === 0}
				<p class="empty-state">No entries yet.</p>
			{:else}
				{#each groupedDates as d (d.toString())}
					<section class="date-group">
						<header class="date-group-header">
							<span class="date-group-date-label"
								>{d === 'Unknown date' ? 'Unknown date' : formatDateLabel(d)}</span
							>
						</header>

						<ul class="time-list">
							{#each groupedByDate[d] as entry (entry.id)}
								{@const isRowRunning = entry.end_date == null}
								{@const startParsed = Date.parse(entry.start_date)}
								{@const rowLiveMs =
									isRowRunning && Number.isFinite(startParsed)
										? Math.max(0, nowMs - startParsed)
										: (entry.duration_ms ?? 0)}

								<li class="time-item">
									<div class="time-row">
										<div class="time-main">
											<span class="time-task">{entry.task}</span>
											<span class="time-sub">
												<span class="time-chip">{entry.category ?? 'Uncategorized'}</span>
												<span class="time-dates">
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

										<div class="time-actions">
											<form method="POST" action="?/delete" use:enhance>
												<input type="hidden" name="id" value={entry.id} />
												<button
													type="submit"
													class="delete-btn"
													disabled={isRowRunning || !!dbRunningEntry}
													onclick={confirmDelete}
												>
													Delete
												</button>
											</form>
										</div>

										<div class="time-meta">
											<span class="time-duration">{formatDuration(rowLiveMs)}</span>
										</div>
									</div>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			{/if}
		</div>

		{#if entriesCsv}
			<CsvExportButton
				label="Export CSV"
				description="Download filtered time entries as CSV"
				csvContent={entriesCsv}
				iconPath={fileReport}
				filename={`time-entries-${new Date().toISOString().slice(0, 10)}.csv`}
			/>
		{/if}
	</div>
</section>

<style>
	.time-layout {
		max-width: 1100px;
		margin: 1.5rem auto;
		padding: 0 1.5rem 2rem;
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.2fr);
		gap: 1.5rem;
	}

	.field-row--inline {
		align-items: flex-end;
	}

	.timer-card {
		margin-top: 0.4rem;
		border-radius: 0.8rem;
		background: rgba(10, 24, 41, 0.9);
		padding: 0.95rem 1rem 1rem;
		box-shadow:
			inset 0 0 0 1px rgba(0, 0, 0, 0.5),
			inset 0 0 12px rgba(0, 0, 0, 0.65);
	}

	.timer-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1rem;
		align-items: start;
	}

	.timer-fields {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
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
		border-radius: 0.95rem; /* curvature but not pill */
		border: 1px solid rgba(190, 212, 233, 0.45);
		background: rgba(12, 30, 52, 0.75);
		box-shadow:
			inset 0 0 0 1px rgba(0, 0, 0, 0.35),
			0 10px 18px rgba(0, 0, 0, 0.28);

		font-weight: 800;
		font-size: clamp(2.2rem, 4vw, 3.1rem);
		letter-spacing: 0.04em;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.timer-cta {
		display: flex;
		justify-content: flex-end;
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
		opacity: 0.65;
		cursor: not-allowed;
	}

	.timer-start {
		background: rgba(59, 176, 126, 0.25);
		color: #a5ffcf;
		border-color: rgba(59, 176, 126, 0.55);
	}

	.timer-start:hover:not(:disabled) {
		background: rgba(59, 176, 126, 0.45);
		transform: translateY(-1px);
	}

	.timer-stop {
		background: rgba(214, 88, 95, 0.25);
		color: #ffb3c1;
		border-color: rgba(214, 88, 95, 0.6);
	}

	.timer-stop:hover:not(:disabled) {
		background: rgba(214, 88, 95, 0.5);
		transform: translateY(-1px);
	}

	.history-header {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.filters-row {
		display: grid;
		grid-template-columns: 1fr minmax(180px, 0.55fr);
		gap: 0.8rem;
		align-items: end;
	}

	.empty-state {
		margin: 0.4rem 0;
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	.date-group {
		margin-bottom: 0.9rem;
	}

	.date-group-header {
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

	.date-group-date-label {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.time-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
	}

	.time-item {
		border-radius: 0.7rem;
		padding: 0.45rem 0.55rem;
		background: radial-gradient(circle at top left, rgba(51, 115, 176, 0.42), rgba(7, 20, 37, 0.9));
		box-shadow:
			0 6px 14px rgba(0, 0, 0, 0.45),
			0 0 0 1px rgba(0, 0, 0, 0.55);
	}

	.time-row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 0.75rem 0.5rem;
		align-items: center;
	}

	.time-main {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.time-task {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.time-sub {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		min-width: 0;
		flex-wrap: wrap;
	}

	.time-chip {
		font-size: 0.75rem;
		padding: 0.08rem 0.45rem;
		border-radius: 999px;
		border: 1px solid rgba(190, 212, 233, 0.55);
		background: rgba(51, 115, 176, 0.22);
		color: var(--text-primary);
	}

	.time-dates {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.time-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		text-align: right;
		padding-right: 0.4rem;
	}

	.time-duration {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}

	.time-actions {
		display: flex;
		justify-content: flex-end;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.time-item:hover .time-actions {
		opacity: 1;
	}

	.time-actions form {
		margin: 0;
	}

	@media (max-width: 840px) {
		.time-layout {
			grid-template-columns: minmax(0, 1fr);
			max-width: 640px;
		}

		.panel--history {
			max-height: none;
		}

		.history-scroll {
			max-height: 320px;
		}

		.filters-row {
			grid-template-columns: 1fr;
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
