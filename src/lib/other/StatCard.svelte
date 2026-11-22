<script lang="ts">
	let {
		eyebrow = '',
		label = '',
		value = '',
		detail = '',
		tone = 'default'
	} = $props<{
		eyebrow?: string;
		label?: string;
		value?: string;
		detail?: string;
		tone?: 'default' | 'positive' | 'negative';
	}>();
</script>

<div class="stat-card stat-card--{tone}">
	{#if eyebrow}
		<p class="stat-card__eyebrow">{eyebrow}</p>
	{/if}
	<p class="stat-card__value">{value}</p>
	<p class="stat-card__label">{label}</p>
	{#if detail}
		<p class="stat-card__detail">{detail}</p>
	{/if}
</div>

<style>
	.stat-card {
		border-radius: var(--radius-lg);
		border: 1px solid var(--border);
		background: radial-gradient(
			100% 75% at 50% 155%,
			var(--bg-subtle-grad1),
			var(--bg-subtle-grad2)
		);
		box-shadow: var(--card-shadow);
		padding: 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.stat-card__eyebrow {
		margin: 0;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.stat-card__value {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 700;
		line-height: 1.2;
		color: var(--text-primary);
		overflow-wrap: anywhere;
	}

	.stat-card--positive .stat-card__value {
		color: var(--color-positive-text);
	}

	.stat-card--negative .stat-card__value {
		color: var(--color-negative-text);
	}

	.stat-card__label {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.stat-card__detail {
		margin: 0.15rem 0 0;
		font-size: 0.72rem;
		line-height: 1.35;
		color: var(--text-muted);
	}
</style>
