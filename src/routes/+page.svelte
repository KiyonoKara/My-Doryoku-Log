<script lang="ts">
	import SectionButton from '$lib/buttons/SectionButton.svelte';
</script>

<section class="dashboard">
	<SectionButton
		label="Finance logging"
		description="Log transactions and see reports"
		iconPath="/src/lib/assets/file-report.svg"
		href="/finance"
	/>

	<SectionButton
		label="Time tracking"
		description="Track how long tasks take"
		iconPath="/src/lib/assets/stopwatch.svg"
		href="/time"
	/>
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
