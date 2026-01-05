<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { WebsocketProvider } from 'y-websocket'

  export let provider: WebsocketProvider | null

  let awarenessStates: [number, any][] = []

  function updateAwareness() {
    if (provider?.awareness) {
      awarenessStates = Array.from(provider.awareness.getStates().entries())
    } else {
      awarenessStates = []
    }
  }

  $: if (provider) {
    updateAwareness()
  }

  onMount(() => {
    if (provider?.awareness) {
      provider.awareness.on('change', updateAwareness)
      updateAwareness()
    }
  })

  onDestroy(() => {
    if (provider?.awareness) {
      provider.awareness.off('change', updateAwareness)
    }
  })

  // Filter out states without user info and limit to show max 10 users
  $: users = awarenessStates
    .filter(([_, state]) => state.user?.name)
    .slice(0, 10)

  $: totalUsers = awarenessStates.filter(([_, state]) => state.user?.name).length
</script>

<div class="user-presence">
  {#if users.length > 0}
    <div class="user-avatars">
      {#each users as [clientId, state], index}
        <div
          class="avatar"
          style="background: {state.user?.color || '#999'}; z-index: {100 - index}; --avatar-glow: {state.user?.color || '#999'}70"
        >
          <span class="avatar-initial">
            {(state.user?.name || 'U')[0].toUpperCase()}
          </span>
          <div class="tooltip">
            {state.user?.name || `User ${clientId}`}
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