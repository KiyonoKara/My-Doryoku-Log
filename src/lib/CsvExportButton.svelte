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
	class="csv-export-button"
	onclick={handleExport}
	aria-label={ariaLabel || label}
>
	<div class="csv-export-button__content">
		{#if iconPath}
			<div class="csv-export-button__icon">
				<img src={iconPath} alt="" aria-hidden="true" />
			</div>
		{/if}
		<div class="csv-export-button__text">
			<h2>{label}</h2>
			{#if description}
				<p>{description}</p>
			{/if}
		</div>
	</div>
</button>

<style>
    .csv-export-button {
        display: block;
        width: 100%;
        max-width: 480px;
        margin: 0 auto;
        padding: 1.25rem 1.5rem;

        background: linear-gradient(
                135deg,
                var(--bg-secondary),
                var(--bg-surface)
        );
        border-radius: 0.9rem;
        border: 1px solid var(--border);
        color: var(--text-primary);
        text-decoration: none;
        cursor: pointer;

        box-shadow:
                0 10px 20px rgba(0, 0, 0, 0.35),
                0 0 0 1px rgba(0, 0, 0, 0.4);

        transition:
                transform 0.2s ease,
                box-shadow 0.2s ease,
                border-color 0.2s ease,
                background 0.25s ease;
    }

    .csv-export-button__content {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .csv-export-button__icon {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
        border-radius: 0.75rem;
        background: rgba(14, 32, 53, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .csv-export-button__icon img {
        width: 28px;
        height: 28px;
        display: block;
        filter: brightness(0) saturate(100%) invert(84%) sepia(65%) saturate(1137%)
        hue-rotate(180deg) brightness(115%) contrast(97%) drop-shadow(0 0 4px rgba(0, 0, 0, 0.5));
    }

    .csv-export-button__text {
        text-align: left;
        flex: 1;
    }

    .csv-export-button__text h2 {
        margin: 0 0 0.15rem 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--text-primary);
        text-align: left;
    }

    .csv-export-button__text p {
        margin: 0;
        padding: 0;
        font-size: 0.9rem;
        color: var(--text-secondary);
        line-height: 1.3;
        text-align: left;
    }

    .csv-export-button:hover {
        transform: translateY(-2px);
        box-shadow:
                0 14px 26px rgba(0, 0, 0, 0.45),
                0 0 0 1px rgba(0, 0, 0, 0.5);
        border-color: var(--border-hover);
        background: linear-gradient(
                135deg,
                var(--bg-secondary),
                var(--accent-hover)
        );
    }

    .csv-export-button:active {
        transform: translateY(0);
        box-shadow:
                0 6px 12px rgba(0, 0, 0, 0.35),
                0 0 0 1px rgba(0, 0, 0, 0.5);
        background: linear-gradient(
                135deg,
                var(--bg-secondary),
                var(--accent)
        );
    }

    .csv-export-button:focus-visible {
        outline: 2px solid var(--border-hover);
        outline-offset: 3px;
    }

    @media (max-width: 600px) {
        .csv-export-button {
            padding: 1rem 1.1rem;
            max-width: 100%;
        }

        .csv-export-button__icon {
            width: 40px;
            height: 40px;
            border-radius: 0.65rem;
        }

        .csv-export-button__icon img {
            width: 24px;
            height: 24px;
        }

        .csv-export-button__text h2 {
            font-size: 1rem;
        }

        .csv-export-button__text p {
            font-size: 0.85rem;
        }
    }
</style>
