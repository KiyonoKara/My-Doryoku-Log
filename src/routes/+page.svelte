<script lang="ts">
	import fileReport from '$lib/assets/file-report.svg';
	import stopwatch from '$lib/assets/stopwatch.svg';
	import SectionButton from '$lib/buttons/SectionButton.svelte';
</script>

<section class="dashboard">
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

	<article class="info-display-card" aria-labelledby="finance-info-title">
		<div class="info-display-card__content">
			<p class="info-display-card__eyebrow">Finance page</p>
			<h2 id="finance-info-title" class="info-display-card__title">Track transactions and money</h2>
			<p class="info-display-card__text">
				Use the finance page to save income and expense entries, review history, see a visual
				breakdown of your finances
			</p>

			<div class="info-display-card__section">
				<h3>Things to do</h3>
				<ul>
					<li>Log transactions with date, amount, category, type, details</li>
					<li>Search, edit, or delete saved entries</li>
					<li>
						Export CSV files, and import the app-generated CSV files to restore history or combine
						data
					</li>
					<li>Review chart summaries and forecasting</li>
				</ul>
			</div>
		</div>
	</article>

	<article class="info-display-card" aria-labelledby="time-info-title">
		<div class="info-display-card__content">
			<p class="info-display-card__eyebrow">Time page</p>
			<h2 id="time-info-title" class="info-display-card__title">Track tasks by time spent</h2>
			<p class="info-display-card__text">
				Use the time page to start a task timer and stop it when done, keep a history of completed
				sessions with category and times
			</p>

			<div class="info-display-card__section">
				<h3>Things to do</h3>
				<ul>
					<li>Name a task, choose a category, and start the timer</li>
					<li>Pause, resume, or stop the active timer</li>
					<li>Search, edit, or delete saved entries</li>
					<li>
						Export CSV files and import the app-generated CSV files to restore history or combine
						data
					</li>
				</ul>
			</div>
		</div>
	</article>
</section>

<style>
	.dashboard {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.25rem;
		padding: 1.5rem 1rem;
		max-width: 900px;
		margin: 0 auto;
	}

	@media (min-width: 720px) {
		.dashboard {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
