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
      gap: 0.5rem;
      padding: 0.5em 1em;
      border-radius: 0.5em;
      border: 1px solid var(--border);
      margin-top: 1.5rem;
      margin-left: 1.5rem;
      background: linear-gradient(135deg, var(--bg-secondary), var(--bg-surface));
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

	.submit-button:hover {
      transform: translateY(-1px);
      box-shadow:
              0 10px 20px rgba(0, 0, 0, 0.45),
              0 0 0 1px rgba(0, 0, 0, 0.5);
      border-color: var(--border-hover);
      background: linear-gradient(135deg, var(--bg-secondary), var(--accent-hover));
	}

	.submit-button.pressed {
		/*background-color: #122335;*/
		background-color: #a2c0df;
		color: #1c2127;
	}

	.submit-button:focus-visible {
		background-color: #bed4e9;
		color: #1c2127;
		transition:
			background-color 5s ease-in-out,
			color 5s ease-in-out;
	}
</style>
