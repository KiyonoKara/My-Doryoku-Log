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
	class="action-card"
	on:click={handleNavigate}
	aria-label={ariaLabel || label}
	role="link"
>
	<div class="action-card__content">
		{#if iconPath}
			<div class="action-card__icon">
				<img src={iconPath} alt="" aria-hidden="true" />
			</div>
		{/if}
		<div class="action-card__text">
			<h2>{label}</h2>
			{#if description}
				<p>{description}</p>
			{/if}
		</div>
	</div>
</button>
