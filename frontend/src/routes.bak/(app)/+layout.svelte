<script lang="ts">
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import { auth, hasWorkspaceSession } from '$lib/stores/auth'
  import { NotificationContainer } from '$lib/components/ui'
  import type { Snippet } from 'svelte'

  interface Props {
    children: Snippet
  }

  let { children }: Props = $props()

  let isPublicShareRoute = $derived($page.url.pathname.startsWith('/share/'))
  let isProjectsRoute = $derived($page.url.pathname === '/projects' || $page.url.pathname.startsWith('/projects/'))
  let isGuestUser = $derived($auth.user?.user_type === 'guest')

  $effect(() => {
    if (!browser || isPublicShareRoute) {
      return
    }

    if (!$hasWorkspaceSession) {
      goto('/login', { replaceState: true })
      return
    }

    if (isGuestUser && isProjectsRoute) {
      goto('/login', { replaceState: true })
    }
  })
</script>

<NotificationContainer />
{@render children()}

