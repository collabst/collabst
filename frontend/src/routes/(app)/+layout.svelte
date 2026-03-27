<script lang="ts">
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import { hasWorkspaceSession } from '$lib/stores/auth'
  import { NotificationContainer } from '$lib/components/ui'
  import type { Snippet } from 'svelte'

  interface Props {
    children: Snippet
  }

  let { children }: Props = $props()

  let isPublicShareRoute = $derived($page.url.pathname.startsWith('/share/'))

  $effect(() => {
    if (!browser || isPublicShareRoute || $hasWorkspaceSession) {
      return
    }

    goto('/login', { replaceState: true })
  })
</script>

<NotificationContainer />
{@render children()}

