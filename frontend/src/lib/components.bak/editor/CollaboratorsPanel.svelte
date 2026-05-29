<script lang="ts">
  import type { WebsocketProvider } from 'y-websocket'

  export let provider: WebsocketProvider | null
  export let onClose: () => void

  $: awarenessStates = provider?.awareness
    ? Array.from(provider.awareness.getStates().entries())
    : []
</script>

<aside class="collaborators-panel">
  <div class="panel-header">
    <h3>Collaborators</h3>
    <button on:click={onClose} class="close-btn">
      ×
    </button>
  </div>
  <div class="panel-content">
    <p class="info">
      Manage collaborators from the project settings
    </p>
    <div class="online-users">
      <h4>Online Now ({awarenessStates.length})</h4>
      {#if awarenessStates.length > 0}
        <div class="user-list">
          {#each awarenessStates as [clientId, state]}
            <div class="user">
              <div
                class="user-dot"
                style="background: {state.user?.color || '#999'}"
              ></div>
              <span class="user-name">{state.user?.name || `User ${clientId}`}</span>
            </div>
          {/each}
        </div>
      {:else}
        <p class="no-users">No other users online</p>
      {/if}
    </div>
  </div>
</aside>

<style>
  .collaborators-panel {
    width: 300px;
    background: var(--surface-primary);
    border-left: 1px solid var(--border-primary);
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-primary);
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-primary);
  }

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .close-btn {
    background: transparent;
    color: var(--text-primary);
    border: none;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .close-btn:hover {
    color: var(--color-error);
  }

  .panel-content {
    flex: 1;
    padding: 1rem;
    color: var(--text-primary);
    overflow-y: auto;
  }

  .info {
    color: var(--text-secondary);
    font-size: 13px;
    margin: 0 0 1.5rem 0;
    padding: 0.75rem;
    background: var(--surface-secondary);
    border-radius: 4px;
  }

  .online-users h4 {
    margin: 0 0 1rem 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .user-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .user {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    background: var(--surface-secondary);
    border-radius: 4px;
  }

  .user-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .user-name {
    font-size: 13px;
    color: var(--text-primary);
  }

  .no-users {
    color: var(--text-secondary);
    font-size: 13px;
    text-align: center;
    padding: 1rem;
    margin: 0;
  }
</style>
