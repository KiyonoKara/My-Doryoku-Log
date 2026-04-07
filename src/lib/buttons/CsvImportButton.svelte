<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { applyAction, deserialize } from '$app/forms';

	type ImportMode = 'append' | 'replace';
	let {
		formAction
	}: {
		formAction: string;
	} = $props();

	let busy = $state(false);
	let modeValue = $state<ImportMode>('append');
	let inputKey = $state(0);

	async function handleFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			return;
		}

		busy = true;

		try {
			const fd = new FormData();
			fd.set('mode', modeValue);
			fd.set('file', file);

			const response = await fetch(formAction, {
				method: 'POST',
				body: fd
			});

			// apply data for notifs
			const result = deserialize(await response.text());
			await applyAction(result);

			// refresh after import
			await invalidateAll();
		} finally {
			busy = false;
			// reset file input so same file can be re-selected
			inputKey++;
		}
	}

	function promptFile(mode: ImportMode) {
		modeValue = mode;
		// trigger click on the next tick after mode is set
		setTimeout(() => {
			document.getElementById('csv-import-file-input')?.click();
		}, 0);
	}
</script>

<!-- reset after each import -->
{#key inputKey}
	<input
		id="csv-import-file-input"
		type="file"
		accept=".csv,text/csv"
		style="display:none"
		onchange={handleFileChange}
	/>
{/key}

<!-- action card with two options -->
<div class="action-card action-button csv-import-btn" role="group" aria-label="Import CSV">
	<div class="action-card__content">
		<div class="action-button__text">
			<h2>Import CSV</h2>
			<p class="csv-import-btn__sub">
				{#if busy}
					<span class="spinner" aria-label="Importing…"></span> Importing…
				{:else}
					<button
						type="button"
						class="csv-import-btn__opt"
						disabled={busy}
						onclick={() => promptFile('append')}
					>Append</button>
					<span class="csv-import-btn__sep" aria-hidden="true">·</span>
					<button
						type="button"
						class="csv-import-btn__opt csv-import-btn__opt--replace"
						disabled={busy}
						onclick={() => promptFile('replace')}
					>Replace all</button>
				{/if}
			</p>
		</div>
	</div>
</div>

<style>
    .csv-import-btn {
        background: color-mix(in srgb, var(--bg-raised) 75%, var(--bg-surface) 30%);
        cursor: default;
    }
    .csv-import-btn:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-3);
        border-color: var(--border-hover);
    }
    .csv-import-btn__sub {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        margin: 0;
        flex-wrap: wrap;
    }
    .csv-import-btn__sep {
        color: var(--text-muted);
        font-size: 0.75rem;
        user-select: none;
    }
    .csv-import-btn__opt {
        all: unset;
        font-size: 0.75rem;
        color: var(--color-edit-text);
        cursor: pointer;
        border-bottom: 1px solid transparent;
        transition: border-color var(--transition-fast), color var(--transition-fast);
        white-space: nowrap;
    }
    .csv-import-btn__opt:hover:not(:disabled) {
        border-bottom-color: var(--color-edit-text);
    }
    .csv-import-btn__opt--replace {
        color: var(--color-delete-text);
    }
    .csv-import-btn__opt--replace:hover:not(:disabled) {
        border-bottom-color: var(--color-delete-text);
    }
    .csv-import-btn__opt:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }
</style>