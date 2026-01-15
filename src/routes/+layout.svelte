<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/Header.svelte';
	import BackButton from '$lib/BackButton.svelte';
	import { page } from '$app/state';

	let { children } = $props();

	// Do not show back button on home page
	const currentUrl = $derived(page.url.pathname);
	const renderBackButtonCond = $derived(currentUrl !== '/');
</script>

<svelte:head>
	<title>My Doryoku Log</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<Header label="My Doryoku Log" />

{#if renderBackButtonCond}
	<BackButton label="Home" href="/" />
{/if}

{@render children()}