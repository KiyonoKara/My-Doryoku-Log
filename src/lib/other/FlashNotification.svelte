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
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.85rem;
		font-weight: 500;
		margin: 0;
		box-shadow:
			0 10px 20px rgba(0, 0, 0, 0.5),
			0 0 0 1px rgba(0, 0, 0, 0.6);
		/*animation: flashSlideIn 0.25s ease-out;*/
	}

	.flash--success {
		background: rgba(59, 176, 126, 0.25);
		color: #a5ffcf;
		border: 1px solid rgba(59, 176, 126, 0.5);
	}

	.flash--error {
		background: rgba(214, 88, 95, 0.25);
		color: #ffb3c1;
		border: 1px solid rgba(214, 88, 95, 0.5);
	}

	/*@keyframes flashSlideIn {*/
	/*	from {*/
	/*	opacity: 0;*/
	/*	transform: translateX(16px);*/
	/*}*/
	/*	to {*/
	/*	opacity: 1;*/
	/*	transform: translateX(0);*/
	/*}*/
	/*}*/
</style>
