<script lang="ts">
  import type { WebsocketProvider } from 'y-websocket'
  import { getProfilePicUrl } from '$lib/utils/urls'

  interface UserPresenceProps {
    provider: WebsocketProvider | null
  }

  let { provider }: UserPresenceProps = $props()

  let awarenessStates: [number, any][] = $state([])
  let loadedProfilePics = $state<Record<string, boolean>>({})

  function getUserName(state: any) {
    return state?.user?.name || state?.user?.display_name || null
  }

  function updateAwareness() {
    if (provider?.awareness) {
      awarenessStates = Array.from(provider.awareness.getStates().entries())
    } else {
      awarenessStates = []
    }
  }

  $effect(() => {
    if (!provider?.awareness) {
      awarenessStates = []
      return
    }

    provider.awareness.on('change', updateAwareness)
    updateAwareness()

    return () => {
      provider.awareness.off('change', updateAwareness)
    }
  })

  // Filter out states without user info and limit to show max 10 users
  let users = $derived(
    awarenessStates.filter(([_, state]) => getUserName(state)).slice(0, 10)
  )

  let totalUsers = $derived(
    awarenessStates.filter(([_, state]) => getUserName(state)).length
  )

  function profilePicSrc(userId: string) {
    return getProfilePicUrl(userId)
  }

  function handleAvatarLoad(userId: string) {
    loadedProfilePics = { ...loadedProfilePics, [userId]: true }
  }

  function hasLoadedAvatar(userId: string) {
    return !!loadedProfilePics[userId]
  }
</script>

<div class="user-presence">
  {#if users.length > 0}
    <div class="user-avatars">
      {#each users as [clientId, state], index}
        <div
          class="avatar"
          style="background: {state.user?.color || '#999'}; z-index: {100 - index}; --avatar-glow: {state.user?.color || '#999'}70"
        >
          {#if state.user?.id}
            <span class="avatar-initial" class:avatar-initial-hidden={hasLoadedAvatar(state.user.id)}>
              {(getUserName(state) || 'U')[0].toUpperCase()}
            </span>
            <img
              class="avatar-image"
              class:avatar-image-loaded={hasLoadedAvatar(state.user.id)}
              src={profilePicSrc(state.user.id)}
              alt={`${getUserName(state) || 'User'} avatar`}
              onload={() => handleAvatarLoad(state.user.id)}
              onerror={() => {}}
            />
          {:else}
            <span class="avatar-initial">
              {(getUserName(state) || 'U')[0].toUpperCase()}
            </span>
          {/if}
          <div class="tooltip">
            {getUserName(state) || `User ${clientId}`}
          </div>
        </div>
      {/each}
      {#if totalUsers > 10}
        <div class="avatar more" style="z-index: 0">
          <span class="avatar-initial">+{totalUsers - 10}</span>
          <div class="tooltip">
            +{totalUsers - 10} more
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .user-presence {
    display: flex;
    align-items: center;
  }

  .user-avatars {
    display: flex;
    align-items: center;
  }

  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
    margin-left: -8px;
  }

  .avatar:first-child {
    margin-left: 0;
  }

  .avatar:hover {
    transform: scale(1.2) translateY(+5%);
    z-index: 200 !important;
    box-shadow: 0 1px 12px var(--avatar-glow);
    filter: saturate(1.7);
  }

  .avatar-initial {
    color: white;
    font-size: 14px;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .avatar-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    opacity: 0;
    overflow: hidden;
  }

  .avatar-image-loaded {
    opacity: 1;
  }

  .avatar-initial-hidden {
    opacity: 0;
  }

  .avatar.more {
    background: var(--surface-secondary);
  }

  .avatar.more .avatar-initial {
    font-size: 11px;
  }

  .tooltip {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 8px;
    padding: 4px 8px;
    background: var(--bg-editor);
    color: var(--text-primary);
    font-size: 12px;
    font-weight: bold;
    white-space: nowrap;
    border-radius: 4px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
    border: 1px solid var(--border-primary);
  }

  .tooltip::after {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: var(--avatar-glow);
  }

  .avatar:hover .tooltip {
    opacity: 1;
    box-shadow: var(--shadow-lg);
  }
</style>