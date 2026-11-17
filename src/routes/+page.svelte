<script lang="ts">
	import { resolve } from '$app/paths';
	import fileReport from '$lib/assets/file-report.svg';
	import stopwatch from '$lib/assets/stopwatch.svg';
	import SectionButton from '$lib/buttons/SectionButton.svelte';
	import StatCard from '$lib/other/StatCard.svelte';
	import type { Transaction, TimeEntry } from '$lib/server/db/schema';
	import { MONTH_NAMES } from '$lib/types/time';
	import { MIN_REQ_TRANSACTIONS } from '$lib/types/finance';
	import { currencyStore } from '$lib/stores/currency.svelte';
	import { formatDateLabel, formatDuration, formatTime, toYmd } from '$lib/utils/util';
	import {
		currentStreak,
		entryDay,
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
	let streak = $derived(currentStreak(trackedDays(entries), today));
	let active = $derived(runningEntry(entries));
	let activity = $derived(recentActivity(transactions, entries, 5));

	let isEmpty = $derived(transactions.length === 0 && entries.length === 0);

	// the models train per type, so track progress toward each threshold separately
	let expenseCount = $derived(transactions.filter((tx) => tx.type === 'expense').length);
	let incomeCount = $derived(transactions.filter((tx) => tx.type === 'income').length);
	let forecastingReady = $derived(
		expenseCount >= MIN_REQ_TRANSACTIONS && incomeCount >= MIN_REQ_TRANSACTIONS
	);
	// count down to the nearest side that is still locked
	// taking the max across both would let an unlocked side mask a locked one and report "0 more" while a model
	// is still untrained
	let forecastingValue = $derived.by(() => {
		if (forecastingReady) {
			return 'Unlocked';
		}

		const gaps = [MIN_REQ_TRANSACTIONS - expenseCount, MIN_REQ_TRANSACTIONS - incomeCount].filter(
			(gap) => gap > 0
		);

		return `${Math.min(...gaps)} more to go`;
	});

	$effect(() => {
		if (!active) {
			return;
		}

		const interval = setInterval(() => {
			nowMs = Date.now();
		}, 1000);

		return () => clearInterval(interval);
	});

	// wall clock time since the started session intentionally isn't shown as the recorded duration
	// since pause state is only in the time page
	// a paused session still reads as running from this
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
				Nothing recorded yet. Save a transaction to begin tracking money, or run the timer while you
				work on a task. Predictions switch on once one side reaches {MIN_REQ_TRANSACTIONS} entries.
			</p>
		</article>
	{:else}
		<div class="dashboard__section">
			<h2 class="dashboard__section-title">Today</h2>

			<div class="stat-row">
				<StatCard
					eyebrow="Time"
					value={formatDuration(daySummary.totalMs)}
					label="Tracked today"
					detail={daySummary.sessions === 1 ? '1 session' : `${daySummary.sessions} sessions`}
				/>

				<StatCard
					eyebrow="Streak"
					value={streak === 1 ? '1 day' : `${streak} days`}
					label="Current streak"
					detail={streak > 0
						? 'Consecutive days with tracked time'
						: 'Log a session to start a streak'}
				/>
			</div>

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
		</div>

		<div class="dashboard__section">
			<h2 class="dashboard__section-title">{monthLabel}</h2>

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
		</div>

		<div class="dashboard__section">
			<h2 class="dashboard__section-title">Predictions</h2>

			<div class="stat-row stat-row--predictions">
				<StatCard
					eyebrow="All time"
					value={forecastingValue}
					label="Forecasting"
					detail={`Expenses ${expenseCount}/${MIN_REQ_TRANSACTIONS} · Income ${incomeCount}/${MIN_REQ_TRANSACTIONS}`}
				/>
			</div>
		</div>
	{/if}

	<div class="dashboard__section">
		<h2 class="dashboard__section-title">Quick start</h2>

		<div class="quick-start">
			<SectionButton
				label="Finance logging"
				description="Log transactions and see reports"
				iconPath={fileReport}
				href="/finance"
			/>

			<SectionButton
				label="Time tracking"
				description="Track how long tasks take"
				iconPath={stopwatch}
				href="/time"
			/>
		</div>
	</div>

	{#if !isEmpty}
		<div class="dashboard__section">
			<h2 class="dashboard__section-title">Recent activity</h2>

			<div class="history-scroll">
				{#if activity.length === 0}
					<p class="empty-state">No finished entries yet</p>
				{:else}
					<ul class="history-list">
						{#each activity as item (activityKey(item))}
							<li class="history-item">
								<div class="history-item__row">
									<div class="history-item__main">
										<div class="history-item__main-top">
											{#if item.kind === 'transaction'}
												<span
													class="history-item__type history-item__type--{item.transaction.type}"
												>
													{item.transaction.type}
												</span>
												<span class="history-item__category">
													{item.transaction.category}
												</span>
											{:else}
												<span class="history-item__type">
													{item.entry.category}
												</span>
												<span class="history-item__category">{item.entry.task}</span>
											{/if}
										</div>

										{#if item.kind === 'transaction' && item.transaction.description}
											<span class="history-item__description">
												{item.transaction.description}
											</span>
										{/if}
									</div>

									<div class="history-item__meta">
										{#if item.kind === 'transaction'}
											<span class="history-item__amount">
												{item.transaction.type === 'expense' ? '-' : '+'}{currencyStore.format(
													item.transaction.amount
												)}
											</span>
											<span class="history-item__date-label">
												{formatDateLabel(item.transaction.date)}
											</span>
										{:else}
											<span class="history-item__duration">
												{formatDuration(item.entry.duration_ms)}
											</span>
											<span class="history-item__date-label">
												{formatDateLabel(entryDay(item.entry))}
											</span>
										{/if}
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
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

	.dashboard__section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.dashboard__section-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--text-secondary);
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

	/* single card, so cap it instead of letting it span the full row */
	.stat-row--predictions {
		grid-template-columns: minmax(180px, 300px);
	}

	.quick-start {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
	}

	@media (min-width: 720px) {
		.quick-start {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.running-card {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.5rem 1rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-resume-border);
		background: var(--card-grad-bottom);
		box-shadow: var(--shadow-3);
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
	}
</style>
