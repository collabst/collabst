<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { sharingApi } from '$lib/services/api'
  import { auth } from '$lib/stores/auth'
  import { notifications } from '$lib/stores/notifications'

  let shareId = $derived($page.url.pathname.split('/').filter(Boolean).at(-1) ?? '')
  let started = $state(false)
  let errorMessage = $state<string | null>(null)

  async function joinProjectFromShare() {
    if (!shareId) {
      errorMessage = 'Invalid share link.'
      return
    }

    try {
      const result = await sharingApi.accessByShareHash(shareId)

      auth.setGuestSession(
        {
          projectId: result.project_id,
          permission: result.permission,
          shareHash: shareId,
        },
        {
          token: result.access_token ?? null,
          refreshToken: result.refresh_token ?? null,
          user: result.user ?? null,
        },
      )

      await goto(`/editor/${result.project_id}`, { replaceState: true })
      notifications.show('Project added to your workspace.', 'info', 3000)
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      errorMessage = typeof detail === 'string' ? detail : 'This share link is invalid or expired.'
      notifications.show(errorMessage, 'error', 5000)
      await goto('/projects', { replaceState: true })
    }
  }

  $effect(() => {
    if (started) return
    started = true
    void joinProjectFromShare()
  })
</script>

<svelte:head>
  <title>Joining Project - Collabst</title>
</svelte:head>

<div class="share-join-screen" aria-live="polite">
  <h1>Joining project...</h1>
  <p>{errorMessage ?? 'Please wait while we add this project to your workspace.'}</p>
</div>

<style>
  .share-join-screen {
    min-height: 100vh;
    display: grid;
    place-content: center;
    text-align: center;
    gap: 0.5rem;
    padding: 1rem;
    color: var(--text-primary);
    background: var(--bg-primary);
  }

  h1 {
    margin: 0;
    font-size: 1.25rem;
  }

  p {
    margin: 0;
    color: var(--text-secondary);
  }
</style>
