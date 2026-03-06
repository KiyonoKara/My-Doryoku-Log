<script lang="ts">
	export let label: string = 'Submit';
	export let onClick = () => {};

	let pressed: boolean = false;
	let button: HTMLButtonElement;

	function handleClick() {
		pressed = true;
		onClick();

		setTimeout(() => {
			pressed = false;
		}, 300);
	}
</script>

<button
	bind:this={button}
	class="submit-button"
	class:pressed
	on:click={handleClick}
	on:animationend={() => (pressed = false)}
	>{label}
</button>

<style>
	.submit-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5em 1em;
		border-radius: 0.5em;
		border: 1px solid var(--border);
		margin-top: 1.5rem;
		margin-left: 1.5rem;
		background: linear-gradient(180deg, var(--bg-secondary), var(--bg-surface));
		color: var(--text-primary);
		cursor: pointer;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
		box-shadow: var(--shadow-2);
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast),
			background var(--transition-base),
			border-color var(--transition-base);
	}

	.submit-button:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow:
			0 10px 20px rgba(0, 0, 0, 0.45),
			0 0 0 1px rgba(0, 0, 0, 0.5);
		border-color: var(--border-hover);
		background: linear-gradient(180deg, var(--bg-secondary), var(--accent-hover));
	}

	.submit-button:active:not(:disabled),
	.submit-button.pressed {
		transform: translateY(0) scale(0.98);
		box-shadow: var(--shadow-1);
		background: var(--accent-hover);
	}

	.submit-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.submit-button:focus-visible {
		outline: 2px solid var(--border-hover);
		outline-offset: 3px;
	}
</style>
