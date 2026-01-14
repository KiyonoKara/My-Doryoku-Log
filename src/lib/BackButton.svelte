<script lang="ts">
	import { goto } from '$app/navigation';

	export let label: string = '';
	export let href: string = '/';
	export let ariaLabel: string = '';

	function handleClick() {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(href);
	}
</script>

<button
	type="button"
	class="back-button"
	on:click={handleClick}
	aria-label={ariaLabel}
>
  <span class="back-button__icon">
    <img src="/src/lib/assets/left-arrow.svg" alt="" aria-hidden="true" />
  </span>
	<span class="back-button__text">{label}</span>
</button>

<style>
    .back-button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;

        padding: 0.5rem 0.9rem;
        border-radius: 100px;
        border: 1px solid var(--border);
        background: linear-gradient(
                135deg,
                var(--bg-secondary),
                var(--bg-surface)
        );
        color: var(--text-primary);
        cursor: pointer;
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 500;
        box-shadow:
                0 6px 14px rgba(0, 0, 0, 0.35),
                0 0 0 1px rgba(0, 0, 0, 0.4);
        transition:
                transform 0.15s ease,
                box-shadow 0.15s ease,
                border-color 0.15s ease,
                background 0.2s ease;
    }

    .back-button__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 100px;
        background: rgba(14, 32, 53, 0.8);
        color: var(--text-primary);
    }

		.back-button__icon img {
        width: 20px;
        height: 20px;
        display: block;
        filter: brightness(0) saturate(100%) invert(84%) sepia(65%) saturate(1137%) hue-rotate(180deg)
        brightness(115%) contrast(97%) drop-shadow(0 0 4px rgba(0, 0, 0, 0.5));
		}

    .back-button__text {
        white-space: nowrap;
    }

    .back-button:hover {
        transform: translateY(-1px);
        box-shadow:
                0 10px 20px rgba(0, 0, 0, 0.45),
                0 0 0 1px rgba(0, 0, 0, 0.5);
        border-color: var(--border-hover);
        background: linear-gradient(
                135deg,
                var(--bg-secondary),
                var(--accent-hover)
        );
    }

    .back-button:active {
        transform: translateY(0);
        box-shadow:
                0 4px 10px rgba(0, 0, 0, 0.35),
                0 0 0 1px rgba(0, 0, 0, 0.5);
        background: linear-gradient(
                135deg,
                var(--bg-secondary),
                var(--accent)
        );
    }

    .back-button:focus-visible {
        outline: 2px solid var(--border-hover);
        outline-offset: 3px;
    }
</style>
