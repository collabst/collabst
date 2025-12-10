<script lang="ts">
	import favicon from '$lib/assets/collabst-logo.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
