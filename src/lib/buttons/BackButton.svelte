<script lang="ts">
	import leftArrow from '$lib/assets/left-arrow.svg';
	import { goto } from '$app/navigation';

	export let label: string = '';
	export let href: string = '/';
	export let ariaLabel: string = '';

	function handleClick() {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(href);
	}
</script>

<button type="button" class="back-button" on:click={handleClick} aria-label={ariaLabel}>
	<span class="back-button__icon">
		<img src={leftArrow} alt="" aria-hidden="true" />
	</span>
	<span class="back-button__text">{label}</span>
</button>

<style>
	.back-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.8rem 0.4rem 0.5rem;
		border-radius: var(--radius-pill);
		border: 1px solid var(--border-subtle);
		margin-top: 1.25rem;
		margin-left: 1.25rem;
		background: var(--bg-deep);
		color: var(--text-primary);
		cursor: pointer;
		font-size: 0.88rem;
		font-weight: 500;
		box-shadow: var(--shadow-1);
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast),
			border-color var(--transition-fast),
			background var(--transition-base);
	}

	.back-button__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-pill);
		background: rgba(0, 0, 0, 0.3);
	}

	.back-button__icon img {
		width: 16px;
		height: 16px;
		display: block;
		filter: var(--icon-filter);
	}

	.back-button__text {
		white-space: nowrap;
	}

	.back-button:hover {
		transform: translateY(-1px);
		box-shadow: var(--shadow-2);
		border-color: var(--border-mid);
		background: var(--bg-raised);
	}

	.back-button:active {
		transform: translateY(0);
		box-shadow: var(--shadow-1);
	}

	.back-button:focus-visible {
		outline: 2px solid var(--border-hover);
		outline-offset: 3px;
	}
</style>
