<script lang="ts">
	import { fly, fade } from 'svelte/transition';

	let {
		flashType = 'success',
		message = null,
		durationMs = 5000
	} = $props<{
		flashType?: string;
		message?: string | null;
		durationMs?: number;
	}>();

	// keep mounted for fancy transitions
	let visible = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (timer) {
			clearTimeout(timer);
		}
		timer = null;

		if (!message) {
			visible = false;
			return;
		}

		visible = true;

		timer = setTimeout(() => {
			visible = false;
		}, durationMs);

		return () => {
			if (timer) {
				clearTimeout(timer);
			}
			timer = null;
		};
	});
</script>

<div class="flash-container" aria-live="polite" aria-atomic="true">
	{#if visible}
		<p
			class="flash"
			class:flash--success={flashType === 'success'}
			class:flash--error={flashType === 'error'}
			in:fly={{ x: 16, duration: 250 }}
			out:fade={{ duration: 250 }}
		>
			{message}
		</p>
	{/if}
</div>

<style>
	.flash-container {
		position: fixed;
		top: calc(var(--header-height) + 1rem);
		right: 1.1rem;
		z-index: 1000;
		pointer-events: none;
	}

	.flash {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 0.85rem;
		border-radius: var(--radius-md);
		font-size: 0.85rem;
		font-weight: 500;
		margin: 0;
		box-shadow: var(--shadow-3);
	}

	.flash--success {
		background: var(--color-positive-bg);
		color: var(--color-positive-text);
		border: 1px solid var(--color-positive-border);
	}

	.flash--error {
		background: var(--color-negative-bg);
		color: var(--color-negative-text);
		border: 1px solid var(--color-negative-border);
	}
</style>
