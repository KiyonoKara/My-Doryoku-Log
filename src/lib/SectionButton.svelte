<script lang="ts">
	import { goto } from '$app/navigation';

	export let label: string = 'Open';
	export let description: string = '';
	export let iconPath: string = '';
	export let onClick: (() => void) | undefined = undefined;
	export let href: string = '/';
	export let ariaLabel = '';

	function handleNavigate() {
		if (href) {
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto(href);
		}
		if (onClick) {
			onClick();
		}
	}
</script>

<button
	type="button"
	class="section-button"
	on:click={handleNavigate}
	aria-label={ariaLabel || label}
	role="link"
>
	<div class="section-button__content">
		{#if iconPath}
			<div class="section-button__icon">
				<img src={iconPath} alt="" aria-hidden="true" />
			</div>
		{/if}
		<div class="section-button__text">
			<h2>{label}</h2>
			{#if description}
				<p>{description}</p>
			{/if}
		</div>
	</div>
</button>

<style>
	.section-button {
		display: block;
		width: 100%;
		max-width: 480px;
		margin: 0 auto;
		padding: 1.25rem 1.5rem;

		background: linear-gradient(135deg, var(--bg-secondary), var(--bg-surface));
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

	.section-button__content {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.section-button__icon {
		width: 48px;
		height: 48px;
		flex-shrink: 0;
		border-radius: 0.75rem;
		background: rgba(14, 32, 53, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.section-button__icon img {
		width: 28px;
		height: 28px;
		display: block;
		filter: brightness(0) saturate(100%) invert(84%) sepia(65%) saturate(1137%) hue-rotate(180deg)
			brightness(115%) contrast(97%) drop-shadow(0 0 4px rgba(0, 0, 0, 0.5));
	}

	.section-button__text {
		text-align: left;
		flex: 0.85;
	}

	.section-button__text h2 {
		margin: 0 0 0.15rem 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
		text-align: left;
	}

	.section-button__text p {
		margin: 0;
		padding: 0;
		font-size: 0.9rem;
		color: var(--text-secondary);
		line-height: 1.3;
		text-align: left;
	}

	.section-button:hover {
		transform: translateY(-2px);
		box-shadow:
			0 14px 26px rgba(0, 0, 0, 0.45),
			0 0 0 1px rgba(0, 0, 0, 0.5);
		border-color: var(--border-hover);
		background: linear-gradient(135deg, var(--bg-secondary), var(--accent-hover));
	}

	.section-button:active {
		transform: translateY(0);
		box-shadow:
			0 6px 12px rgba(0, 0, 0, 0.35),
			0 0 0 1px rgba(0, 0, 0, 0.5);
		background: linear-gradient(135deg, var(--bg-secondary), var(--accent));
	}

	.section-button:focus-visible {
		outline: 2px solid var(--border-hover);
		outline-offset: 3px;
	}

	@media (max-width: 600px) {
		.section-button {
			padding: 1rem 1.1rem;
			max-width: 100%;
		}

		.section-button__icon {
			width: 40px;
			height: 40px;
			border-radius: 0.65rem;
		}

		.section-button__icon img {
			width: 24px;
			height: 24px;
		}

		.section-button__text h2 {
			font-size: 1rem;
		}

		.section-button__text p {
			font-size: 0.85rem;
		}
	}
</style>
