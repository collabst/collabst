<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import AuthLayout from '$lib/components/auth/AuthLayout.svelte'
  import { sharingApi } from '$lib/services/api'
  import { auth, hasWorkspaceSession } from '$lib/stores/auth'
  import { notifications } from '$lib/stores/notifications'

  let shareId = $derived($page.url.pathname.split('/').filter(Boolean).at(-1) ?? '')
  let loginHref = $derived(`/login?next=${encodeURIComponent(`/share/${shareId}`)}`)
  let registerHref = $derived(`/register?next=${encodeURIComponent(`/share/${shareId}`)}`)

  let started = $state(false)
  let isJoining = $state(false)
  let isGuestSubmitting = $state(false)
  let showGuestEntry = $state(false)
  let errorMessage = $state<string | null>(null)
  let displayName = $state('')

  async function joinWithExistingSession() {
    if (!shareId) {
      errorMessage = 'Invalid share link.'
      return
    }

    isJoining = true
    errorMessage = null

    try {
      const result = await sharingApi.accessByShareHash(shareId)
      const isGuestUser = $auth.user?.user_type === 'guest'

      if (isGuestUser) {
        auth.setGuestSession({
          projectId: result.project_id,
          permission: result.permission,
          shareHash: shareId,
        })
      } else {
        auth.clearGuestSession()
      }

      await goto(`/editor/${result.project_id}`, { replaceState: true })
      notifications.show('Project added to your workspace.', 'info', 3000)
    } catch (error: any) {
      const status = error?.response?.status
      const detail = error?.response?.data?.detail

      if (status === 401 || status === 403) {
        auth.resetSession()
        showGuestEntry = true
        errorMessage = 'Your session has expired or is not valid for this link. Continue as guest or sign in.'
        return
      }

      errorMessage = typeof detail === 'string' ? detail : 'This share link is invalid or expired.'
      notifications.show(errorMessage, 'error', 5000)
    } finally {
      isJoining = false
    }
  }

  async function loginAsGuest(event: Event) {
    event.preventDefault()
    errorMessage = null

    const normalizedDisplayName = displayName.trim()
    if (!normalizedDisplayName) {
      errorMessage = 'Display name is required.'
      return
    }

    isGuestSubmitting = true
    try {
      await auth.guestLogin(normalizedDisplayName, shareId)
      await joinWithExistingSession()
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      errorMessage = typeof detail === 'string' ? detail : 'Unable to create guest session for this share link.'
      notifications.show(errorMessage, 'error', 5000)
    } finally {
      isGuestSubmitting = false
    }
  }

  $effect(() => {
    if (started) return
    started = true

    if (!$hasWorkspaceSession) {
      showGuestEntry = true
      return
    }

    void joinWithExistingSession()
  })
</script>

<svelte:head>
  <title>Joining Project - Collabst</title>
</svelte:head>

{#if showGuestEntry}
  <AuthLayout>
    <h1>Join Shared Project</h1>
    <h2>Continue as guest</h2>

    {#if errorMessage}
      <div class="error">{errorMessage}</div>
    {/if}

    <form onsubmit={loginAsGuest}>
      <div class="field">
        <label for="guest-display-name">Display Name</label>
        <input
          id="guest-display-name"
          type="text"
          bind:value={displayName}
          required
          placeholder="Your name"
          autocomplete="nickname"
        />
      </div>

      <button type="submit" disabled={isGuestSubmitting || !shareId}>
        {isGuestSubmitting ? 'Joining...' : 'Join as Guest'}
      </button>
    </form>

    <p class="footer">
      Already have an account? <a href={loginHref}>Login</a>
      {' · '}
      <a href={registerHref}>Register</a>
    </p>
  </AuthLayout>
{:else}
  <div class="share-join-screen" aria-live="polite">
    <h1>Joining project...</h1>
    <p>{errorMessage ?? 'Please wait while we add this project to your workspace.'}</p>
    {#if isJoining}
      <p class="subtle">Validating your session and share link.</p>
    {/if}
  </div>
{/if}

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

  .subtle {
    font-size: 0.875rem;
  }

  .footer {
    margin-top: 1rem;
    text-align: center;
  }
</style>
