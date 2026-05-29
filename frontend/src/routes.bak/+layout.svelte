<script lang="ts">
  import { onMount } from 'svelte'
  import { theme } from '$lib/stores/theme'
  import '../index.css'
  
  // Initialize theme on mount
  onMount(() => {
    theme.init()
  })
</script>

<slot />
