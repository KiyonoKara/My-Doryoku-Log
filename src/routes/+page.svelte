<script lang="ts">
	import { resolve } from '$app/paths';
	import fileReport from '$lib/assets/file-report.svg';
	import stopwatch from '$lib/assets/stopwatch.svg';
	import SectionButton from '$lib/buttons/SectionButton.svelte';
	import StatCard from '$lib/other/StatCard.svelte';
	import type { Transaction, TimeEntry } from '$lib/server/db/schema';
	import { MONTH_NAMES } from '$lib/types/time';
	import { currencyStore } from '$lib/stores/currency.svelte';
	import { daysBetween, formatDateLabel, formatDuration, formatTime, toYmd } from '$lib/utils/util';
	import {
		currentStreak,
		entryDay,
		lastTrackedDay,
		lastTransactionDate,
		monthKey,
		recentActivity,
		runningEntry,
		summarizeDay,
		summarizeMonth,
		trackedDays,
		type ActivityItem
	} from '$lib/utils/summary';

	let { data } = $props();

	let transactions = $derived<Transaction[]>(data.transactions ?? []);
	let entries = $derived<TimeEntry[]>(data.timeEntries ?? []);

	// ticks only while a session is running, so the dashboard does not hold a timer open
	let nowMs = $state(Date.now());
	let today = $derived(toYmd(new Date(nowMs)));

	let month = $derived(monthKey(today));
	let monthLabel = $derived(
		`${MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? ''} ${month.slice(0, 4)}`
	);

	let monthSummary = $derived(summarizeMonth(transactions, month));
	let daySummary = $derived(summarizeDay(entries, today));
	let tracked = $derived(trackedDays(entries));
	let streak = $derived(currentStreak(tracked, today));
	let active = $derived(runningEntry(entries));

	let isEmpty = $derived(transactions.length === 0 && entries.length === 0);

	// money and time are two separate records, so the panels never share a list
	// an empty array on the other side reuses the same tested merge for one domain only
	let recentTransactions = $derived(recentActivity(transactions, [], 4));
	let recentSessions = $derived(recentActivity([], entries, 4));

	let lastTx = $derived(lastTransactionDate(transactions));
	let lastSession = $derived(lastTrackedDay(tracked));

	// how long the record has been quiet, phrased as information rather than a scold
	function ago(day: string, from: string): string {
		if (!day) {
			return '';
		}

		const days = daysBetween(day, from);
		if (days <= 0) {
			return 'today';
		}

		return days === 1 ? 'yesterday' : `${days} days ago`;
	}

	// a zero in a detail line reads as a gap, so each panel names the absence instead
	let todayDetail = $derived(
		daySummary.sessions === 0
			? 'Nothing yet today'
			: daySummary.sessions === 1
				? '1 session'
				: `${daySummary.sessions} sessions`
	);

	// the stat row answers for this month, the meta line answers for the whole record
	let financeMeta = $derived(
		transactions.length === 0
			? 'No transactions yet'
			: `${transactions.length} recorded · last entry ${ago(lastTx, today)}`
	);

	let timeMeta = $derived(
		entries.length === 0
			? 'No sessions yet'
			: entries.length === 1
				? '1 session recorded'
				: `${entries.length} sessions recorded`
	);

	$effect(() => {
		if (!active) {
			return;
		}

		const interval = setInterval(() => {
			nowMs = Date.now();
		}, 1000);

		return () => clearInterval(interval);
	});

	// wall clock time since the started session, which isn't the recorded duration since the pause
	// state is in the time page and a paused session still reads as running from here
	let elapsedMs = $derived.by(() => {
		if (!active) {
			return 0;
		}
		const start = Date.parse(active.start_date);
		return Number.isFinite(start) ? Math.max(0, nowMs - start) : 0;
	});

	let netTone = $derived<'default' | 'positive' | 'negative'>(
		monthSummary.net > 0 ? 'positive' : monthSummary.net < 0 ? 'negative' : 'default'
	);

	// both kinds have their own row
	// the key has to come from whichever is present
	function activityKey(item: ActivityItem): string {
		return `${item.kind}-${item.kind === 'transaction' ? item.transaction.id : item.entry.id}`;
	}
</script>

<section class="dashboard">
	{#if isEmpty}
		<article class="panel dashboard__start">
			<h2 class="panel-title">Start your log</h2>
			<p class="dashboard__start-text">
				Nothing yet...
			</p>
		</article>
	{:else}
		<div class="dashboard__grid">
			<!-- money -->
			<article class="panel dashboard__panel">
				<header class="dashboard__panel-header">
					<h2 class="panel-title">{monthLabel}</h2>
					<span class="dashboard__panel-chip">Finance</span>
				</header>

				<div class="stat-row">
					<StatCard
						eyebrow="Money in"
						value={currencyStore.format(monthSummary.income)}
						label="Income"
						tone="positive"
					/>

					<StatCard
						eyebrow="Money out"
						value={currencyStore.format(monthSummary.expense)}
						label="Expenses"
						tone="negative"
					/>

					<StatCard
						eyebrow="Balance"
						value={currencyStore.format(monthSummary.net)}
						label="Net this month"
						tone={netTone}
						detail={monthSummary.count === 1
							? '1 entry this month'
							: `${monthSummary.count} entries this month`}
					/>
				</div>

				<p class="dashboard__meta">{financeMeta}</p>

				<SectionButton
					label="Log a transaction"
					description="Record money in or out"
					iconPath={fileReport}
					href="/finance"
				/>

				<div class="history-scroll">
					{#if recentTransactions.length === 0}
						<p class="empty-state">No transactions yet</p>
					{:else}
						<ul class="history-list">
							{#each recentTransactions as item (activityKey(item))}
								{#if item.kind === 'transaction'}
									<li class="history-item">
										<div class="history-item__row">
											<div class="history-item__main">
												<div class="history-item__main-top">
													<span
														class="history-item__type history-item__type--{item.transaction.type}"
													>
														{item.transaction.type}
													</span>
													<span class="history-item__category">
														{item.transaction.category}
													</span>
												</div>

												{#if item.transaction.description}
													<span class="history-item__description">
														{item.transaction.description}
													</span>
												{/if}
											</div>

											<div class="history-item__meta">
												<span class="history-item__amount">
													{item.transaction.type === 'expense' ? '-' : '+'}{currencyStore.format(
														item.transaction.amount
													)}
												</span>
												<span class="history-item__date-label">
													{formatDateLabel(item.transaction.date)}
												</span>
											</div>
										</div>
									</li>
								{/if}
							{/each}
						</ul>
					{/if}
				</div>
			</article>

			<!-- time -->
			<article class="panel dashboard__panel">
				<header class="dashboard__panel-header">
					<h2 class="panel-title">Today</h2>
					<span class="dashboard__panel-chip">Time</span>
				</header>

				{#if active}
					<article class="running-card">
						<div class="running-card__main">
							<p class="running-card__eyebrow">Running now</p>
							<p class="running-card__task">{active.task}</p>
							<p class="running-card__meta">
								{active.category} · started {formatTime(active.start_date)}
							</p>
						</div>

						<div class="running-card__elapsed">
							<p class="running-card__timer">{formatDuration(elapsedMs)}</p>
							<p class="running-card__timer-label">elapsed since start</p>
						</div>

						<a class="running-card__link" href={resolve('/time')}>Pause or stop</a>
					</article>
				{/if}

				<div class="stat-row">
					<StatCard
						eyebrow="Time"
						value={formatDuration(daySummary.totalMs)}
						label="Tracked today"
						detail={todayDetail}
					/>

					{#if streak > 0}
						<StatCard
							eyebrow="Streak"
							value={streak === 1 ? '1 day' : `${streak} days`}
							label="Current streak"
							detail="Consecutive days with tracked time"
						/>
					{:else}
						<!-- a zero streak is a judgement, the gap since the last session is information -->
						<StatCard
							eyebrow="Last tracked"
							value={lastSession ? ago(lastSession, today) : '—'}
							label="Since your last session"
							detail={lastSession ? formatDateLabel(lastSession) : 'No sessions yet'}
						/>
					{/if}
				</div>

				<p class="dashboard__meta">{timeMeta}</p>

				<SectionButton
					label="Start tracking"
					description="Run the timer on a task"
					iconPath={stopwatch}
					href="/time"
				/>

				<div class="history-scroll">
					{#if recentSessions.length === 0}
						<p class="empty-state">No finished sessions yet</p>
					{:else}
						<ul class="history-list">
							{#each recentSessions as item (activityKey(item))}
								{#if item.kind === 'time'}
									<li class="history-item">
										<div class="history-item__row">
											<div class="history-item__main">
												<div class="history-item__main-top">
													<span class="history-item__type">{item.entry.category}</span>
													<span class="history-item__category">{item.entry.task}</span>
												</div>
											</div>

											<div class="history-item__meta">
												<span class="history-item__duration">
													{formatDuration(item.entry.duration_ms)}
												</span>
												<span class="history-item__date-label">
													{formatDateLabel(entryDay(item.entry))}
												</span>
											</div>
										</div>
									</li>
								{/if}
							{/each}
						</ul>
					{/if}
				</div>
			</article>
		</div>
	{/if}
</section>

<style>
	.dashboard {
		max-width: var(--panel-length);
		margin: 1.5rem auto;
		padding: 0 1.5rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* two records, two columns, the same split the other pages use */
	.dashboard__grid {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.2fr);
		gap: 1.5rem;
	}

	.dashboard__panel {
		min-width: 0;
	}

	.dashboard__panel-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.dashboard__panel-chip {
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.dashboard__meta {
		margin: 0;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.dashboard__start {
		gap: 0.4rem;
	}

	.dashboard__start-text {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.stat-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.8rem;
	}

	.running-card {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.5rem 1rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-resume-border);
		background: var(--card-grad-bottom);
		box-shadow: var(--card-bottom-shadow);
		padding: 0.9rem 1rem;
	}

	.running-card__main {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.running-card__eyebrow {
		margin: 0;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.running-card__task {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		overflow-wrap: anywhere;
	}

	.running-card__meta {
		margin: 0;
		font-size: 0.78rem;
		color: var(--text-secondary);
	}

	.running-card__elapsed {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
		padding: 0.5rem 0.9rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-mid);
		background: var(--bg-deep-light);
		box-shadow: var(--shadow-inset-alt);
	}

	.running-card__timer {
		margin: 0;
		font-size: 1.3rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		font-variant-numeric: tabular-nums;
		color: var(--text-primary);
	}

	.running-card__timer-label {
		margin: 0;
		font-size: 0.68rem;
		color: var(--text-muted);
	}

	.running-card__link {
		grid-column: 1 / -1;
		justify-self: start;
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--text-secondary);
		text-decoration: none;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 0.1rem;
		transition:
			color var(--transition-base),
			border-color var(--transition-base);
	}

	.running-card__link:hover {
		color: var(--text-primary);
		border-color: var(--border-hover);
	}

	@media (max-width: 840px) {
		.dashboard {
			padding: 0 1rem 2rem;
		}

		.dashboard__grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
