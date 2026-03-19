<script lang="ts">
	export let label: string = 'Export CSV';
	export let description: string = '';
	export let iconPath: string = '';
	export let filename: string = '';
	export let ariaLabel: string = 'Export to CSV';
	export let csvContent: string = '';

	function handleExport() {
		if (!csvContent) {
			alert('No data to export');
			return;
		}

		// create and prompt a download
		const blob = new Blob([csvContent], {
			type: 'text/csv;charset=utf-8;'
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
</script>

<button
	type="button"
	class="action-card action-button csv-export-btn"
	onclick={handleExport}
	aria-label={ariaLabel || label}
>
	<div class="action-card__content">
		{#if iconPath}
			<div class="action-card__icon">
				<img src={iconPath} alt="" aria-hidden="true" />
			</div>
		{/if}
		<div class="action-button__text">
			<h2>{label}</h2>
			{#if description}
				<p>{description}</p>
			{/if}
		</div>
	</div>
</button>

<style>
	.csv-export-btn {
		background: color-mix(in srgb, var(--bg-raised) 75%, var(--bg-surface) 30%);
	}

	.csv-export-btn:hover {
		background: color-mix(in srgb, var(--bg-raised) 85%, rgba(59, 176, 126, 0.15) 15%);
	}
</style>
