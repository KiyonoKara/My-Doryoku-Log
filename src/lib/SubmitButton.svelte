<script>
	export let label = 'Submit';
	export let onClick = () => {};

	let pressed = false;
	let button;

	function handleClick() {
		pressed = true;
		onClick();

		setTimeout(() => {
			pressed = false;
		}, 300);
	}
</script>

<button bind:this={button}
				class="submit-button"
				class:pressed
				on:click={handleClick}
				on:animationend={() => pressed = false}>{label}
</button>

<style>
 .submit-button {
		 border: none;
		 padding: 0.5em 1.0em;
		 border-radius: 0.5em;
		 color: white;
     background-color: #3373b0;
		 font-weight: bold;
		 cursor: pointer;
		 text-align: center;
     display: inline-block;
		 font-size: 1em;
     transition:
						 background-color 0.1s ease-in-out,
             color 0.1s ease-in-out;
 }

 .submit-button:hover {
		 background-color: #0b385f;
		 color: #bed4e9;
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