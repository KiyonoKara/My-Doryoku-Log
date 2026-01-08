<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/Header.svelte';
	let { children } = $props();
</script>

<svelte:head>
	<title>My Doryoku Log</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<Header label="My Doryoku Log" />

{@render children()}
