<script>
	import notebook from '$lib/assets/notebook.svg';
	import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';

	export let label;
</script>

<header class="header">
	<div class="header__icon-wrap" aria-hidden="true">
		<img src={notebook} alt="" />
	</div>
	<h1 class="header__label">{label}</h1>

	<div class="header__controls">
		<ThemeSwitch />
	</div>
</header>

<style>
	.header {
		position: sticky;
		top: 0;
		z-index: 100;
		height: var(--header-height);
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0 1.5rem;
		background: var(--bg-base);
		border-bottom: 1px solid var(--border-subtle);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.05),
			0 4px 16px rgba(0, 0, 0, 0.5);
		justify-content: center;
	}

	.header__icon-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 60px;
		height: 60px;
		border-radius: var(--radius-sm);
		background: var(--accent-subtle);
		border: 1px solid var(--border-subtle);
		flex-shrink: 0;
	}

	.header__icon-wrap img {
		width: 48px;
		height: 48px;
		filter: var(--icon-filter);
	}

	.header__label {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: 0.01em;
	}

	.header__controls {
		position: absolute;
		right: 1.5rem;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
