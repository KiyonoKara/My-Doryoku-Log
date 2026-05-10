<script lang="ts">
	import { currencyStore } from '$lib/stores/currency.svelte';

	const currencies: {
		id: Currency;
		label: string;
		symbol: string;
	}[] = [
		{
			id: 'USD',
			label: 'USD',
			symbol: '$'
		},
		{
			id: 'JPY',
			label: 'JPY',
			symbol: '¥'
		}
	];

	let open = $state(false);

	function select(currency: Currency) {
		currencyStore.set(currency);
		open = false;
	}

	function toggle() {
		open = !open;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="ts-overlay" role="presentation" onclick={() => (open = false)}></div>
{/if}

<div class="ts-wrap">
	<button
		class="ts-trigger"
		onclick={toggle}
		aria-label="Change currency"
		aria-expanded={open}
		aria-haspopup="listbox"
		title="Change currency"
	>
		<span class="currency-symbol" aria-hidden="true">
			{currencyStore.symbol}
		</span>
		<span class="ts-trigger__swatch" aria-hidden="true">
			{currencies.find((c) => c.id === currencyStore.current)?.label ?? 'Currency'}
		</span>
		<svg
			class="ts-trigger__chevron"
			class:open
			width="10"
			height="10"
			viewBox="0 0 10 10"
			aria-hidden="true"
		>
			<path
				d="M2 3.5L5 6.5L8 3.5"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</button>

	{#if open}
		<div class="ts-menu" role="listbox" aria-label="Currency options">
			{#each currencies as currency (currency.id)}
				<button
					class="ts-option"
					class:active={currencyStore.current === currency.id}
					role="option"
					aria-selected={currencyStore.current === currency.id}
					onclick={() => select(currency.id)}
				>
					<span class="currency-symbol-option" aria-hidden="true">{currency.symbol}</span>
					<span class="ts-option__label">{currency.label}</span>
					{#if currencyStore.current === currency.id}
						<span class="ts-option__check" aria-hidden="true">✓</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.ts-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.ts-overlay {
		position: fixed;
		inset: 0;
		z-index: 149;
	}

	.ts-trigger {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.65rem;
		border-radius: var(--radius-pill);
		border: 1px solid var(--border-subtle);
		background: var(--bg-deep);
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 0.82rem;
		box-shadow: var(--shadow-1);
		transition:
			background var(--transition-base),
			border-color var(--transition-base),
			color var(--transition-base),
			box-shadow var(--transition-base);
	}

	.ts-trigger:hover {
		background: var(--bg-raised);
		border-color: var(--border);
		color: var(--text-primary);
		box-shadow: var(--shadow-2);
	}

	.ts-trigger:focus-visible {
		outline: 2px solid var(--border-hover);
		outline-offset: 3px;
	}

	.ts-trigger__swatch {
		width: 25px;
		flex-shrink: 0;
		text-align: left;
	}

	.ts-trigger__chevron {
		color: var(--text-muted);
		transition: transform var(--transition-base);
		flex-shrink: 0;
	}

	.ts-trigger__chevron.open {
		transform: rotate(180deg);
	}

	.ts-menu {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		min-width: 160px;
		background: var(--bg-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-3);
		padding: 0.3rem;
		z-index: 150;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		animation: ts-in 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
		transform-origin: top right;
	}

	:global(.footer__left) .ts-menu {
		top: auto;
		bottom: calc(100% + 0.5rem);
		left: 0;
		right: auto;
		transform-origin: bottom left;
	}

	@keyframes ts-in {
		from {
			opacity: 0;
			transform: scale(0.93) translateY(-4px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	@keyframes ts-in-footer {
		from {
			opacity: 0;
			transform: scale(0.93) translateY(4px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	:global(.footer__left) .ts-menu {
		animation-name: ts-in-footer;
	}

	.ts-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.6rem;
		border-radius: var(--radius-sm);
		border: none;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		width: 100%;
		text-align: left;
		font-size: 0.85rem;
		transition:
			background var(--transition-fast),
			color var(--transition-fast);
	}

	.ts-option:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	.ts-option.active {
		background: var(--accent-subtle);
		color: var(--text-primary);
	}

	.ts-option__label {
		flex-grow: 1;
	}

	.ts-option__check {
		font-size: 0.9rem;
		color: var(--color-positive-text);
	}

	.currency-symbol {
		width: 1.2rem;
		height: 1.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-subtle);
		border: 1px solid var(--border-subtle);
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: bold;
		flex-shrink: 0;
	}

	.currency-symbol-option {
		width: 1rem;
		height: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.9rem;
		font-weight: bold;
		flex-shrink: 0;
	}
</style>
