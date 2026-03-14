<script lang="ts">
	import { themeStore } from '$lib/stores/theme.svelte';

	const themes: {
		id: Theme;
		label: string;
	}[] = [
		{
			id: 'blueberry',
			label: 'Blueberry'
		},
		{
			id: 'system',
			label: 'System'
		},
		{
			id: 'light',
			label: 'Light'
		},
		{
			id: 'dark',
			label: 'Dark'
		}
	];

	let open = $state(false);

	function select(theme: Theme) {
		themeStore.set(theme);
		open = false;
	}

	function toggle() {
		open = !open;
	}

	// let users escape
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- click away overlay -->
{#if open}
	<div class="ts-overlay" role="presentation" onclick={() => (open = false)}></div>
{/if}

<div class="ts-wrap">
	<button
		class="ts-trigger"
		onclick={toggle}
		aria-label="Change theme"
		aria-expanded={open}
		aria-haspopup="listbox"
		title="Change theme"
	>
		<span class="ts-option__swatch ts-option__swatch--{themeStore.current}" aria-hidden="true"
		></span>
		<span class="ts-trigger__swatch" aria-hidden="true">
			{themes.find((t) => t.id === themeStore.current)?.label ?? 'Theme'}
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
		<div class="ts-menu" role="listbox" aria-label="Theme options">
			{#each themes as theme (theme.id)}
				<button
					class="ts-option"
					class:active={themeStore.current === theme.id}
					role="option"
					aria-selected={themeStore.current === theme.id}
					onclick={() => select(theme.id)}
				>
					<span class="ts-option__swatch ts-option__swatch--{theme.id}" aria-hidden="true"></span>
					<span class="ts-option__label">{theme.label}</span>
					{#if themeStore.current === theme.id}
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
		width: 75px;
		flex-shrink: 0;
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

	.ts-option {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		padding: 0.45rem 0.6rem;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 0.85rem;
		text-align: left;
		transition:
			background var(--transition-fast),
			color var(--transition-fast),
			border-color var(--transition-fast);
	}

	.ts-option:hover {
		background: var(--accent-subtle);
		border-color: var(--border-subtle);
		color: var(--text-primary);
	}

	.ts-option.active {
		background: var(--accent-subtle);
		border-color: var(--border);
		color: var(--text-primary);
		font-weight: 500;
	}

	.ts-trigger__swatch,
	.ts-option__swatch {
		flex-shrink: 0;
		border-radius: 50%;
	}

	.ts-option__swatch {
		width: 10px;
		height: 10px;
	}

	.ts-trigger__swatch--blueberry,
	.ts-option__swatch--blueberry {
		background: #3373b0;
	}

	.ts-trigger__swatch--system,
	.ts-option__swatch--system {
		background: linear-gradient(90deg, #a0b8d0 50%, #3a3f4a 50%);
		border-color: rgba(128, 128, 128, 0.25);
	}

	.ts-trigger__swatch--light,
	.ts-option__swatch--light {
		background: #a0b8d0;
		border-color: rgba(0, 0, 0, 0.12);
	}

	.ts-trigger__swatch--dark,
	.ts-option__swatch--dark {
		background: #3a3f4a;
	}

	.ts-option__icon {
		font-size: 0.95rem;
		line-height: 1;
	}

	.ts-option__label {
		flex: 1;
	}

	.ts-option__check {
		font-size: 0.75rem;
		color: var(--accent);
		font-weight: 700;
		margin-left: auto;
	}
</style>
