<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/layout/Header.svelte';
	import Footer from '$lib/layout/Footer.svelte';
	import BackButton from '$lib/buttons/BackButton.svelte';
	import { page } from '$app/state';
	import { themeStore } from '$lib/stores/theme.svelte';

	let { children } = $props();

	// Do not show the back button on the home page
	const currentUrl = $derived(page.url.pathname);
	const renderBackButtonCond = $derived(currentUrl !== '/');

	onMount(() => {
		themeStore.init();
	});
</script>

<svelte:head>
	<title>My Doryoku Log</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="layout-container">
	<Header label="My Doryoku Log" />

	<main class="layout-content">
		{#if renderBackButtonCond}
			<BackButton label="Home" href="/" />
		{/if}

		{@render children()}
	</main>

	<Footer />
</div>
