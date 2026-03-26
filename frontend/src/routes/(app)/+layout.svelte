<script lang="ts">
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'
  import { hasWorkspaceSession } from '$lib/stores/auth'
  import { NotificationContainer } from '$lib/components/ui'
  import { onMount } from 'svelte'

  onMount(() => {
    // Allow either authenticated users or active guest workspace sessions.
    if (!$hasWorkspaceSession) {
      goto('/login', { replaceState: true })
    }
  })

  // Reactive check - redirect if all workspace session state is gone.
  $: if (browser && !$hasWorkspaceSession) {
    goto('/login', { replaceState: true })
  }
</script>

<NotificationContainer />
<slot />

