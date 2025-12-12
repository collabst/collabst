<script lang="ts">
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'
  import { isAuthenticated } from '$lib/stores/auth'
  import { onMount } from 'svelte'

  onMount(() => {
    // Check authentication on mount (client-side only)
    if (!$isAuthenticated) {
      goto('/login', { replaceState: true })
    }
  })

  // Reactive check - redirect if auth changes (client-side only)
  $: if (browser && !$isAuthenticated) {
    goto('/login', { replaceState: true })
  }
</script>

<slot />
