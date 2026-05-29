<script lang="ts">
  import { onMount } from 'svelte'
  import { invitationsApi } from '../services/api'
  import RoleBadge from './ui/RoleBadge.svelte'
  import type { Invitation } from '../types'

  let invitations: Invitation[] = []
  let loading = true

  async function loadInvitations() {
    try {
      invitations = await invitationsApi.listPending()
    } catch (error) {
      console.error('Failed to load invitations:', error)
    } finally {
      loading = false
    }
  }

  async function handleAccept(id: string) {
    try {
      await invitationsApi.accept(id)
      loadInvitations()
      window.location.reload()
    } catch (error) {
      console.error('Failed to accept invitation:', error)
      alert('Failed to accept invitation')
    }
  }

  async function handleDecline(id: string) {
    try {
      await invitationsApi.decline(id)
      loadInvitations()
    } catch (error) {
      console.error('Failed to decline invitation:', error)
    }
  }

  onMount(() => {
    loadInvitations()
  })
</script>

{#if loading}
  <div class="loading">Loading invitations...</div>
{:else if invitations.length > 0}
  <div class="container">
    <div class="header">
      <h3>Pending Invitations ({invitations.length})</h3>
    </div>
    <div class="list">
      {#each invitations as invitation (invitation.id)}
        <div class="invitation">
          <div class="info">
            <div class="role-badge-wrap">
              <RoleBadge role={invitation.role} size="sm" uppercase={true} />
            </div>
            <div class="email">From: {invitation.invitee_email}</div>
            <div class="date">
              {new Date(invitation.created_at).toLocaleDateString()}
            </div>
          </div>
          <div class="actions">
            <button
              on:click={() => handleAccept(invitation.id)}
              class="accept"
            >
              Accept
            </button>
            <button
              on:click={() => handleDecline(invitation.id)}
              class="decline"
            >
              Decline
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .container {
    margin-bottom: 1rem;
    overflow: hidden;
    padding-left: 1.25rem;
    padding-right: 1.25rem;
  }

  .header {
    padding: 1rem 1.25rem;
    padding-bottom: 0.25rem;
  }

  h3 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    font-family: "DM Serif Display", Georgia, serif;
    letter-spacing: -0.015em;
    color: var(--text-secondary);
  }

  .list {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .invitation {
    background: var(--bg-top-bar);
    padding: 1.25rem 2rem;
    border-radius: 18px;
    border: 2px solid var(--border-primary);
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s;
  }

  .invitation:hover {
    /* background: var(--surface-hover); */
    border-color: var(--border-secondary);
  }

  .info {
    flex: 1;
  }

  .role-badge-wrap {
    margin-bottom: 0.5rem;
  }

  .email {
    font-size: 15px;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .date {
    font-size: 13px;
    color: var(--text-tertiary);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  button {
    border: 1px solid transparent;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .accept {
    background: var(--color-tertiary-500);
    color: white;
    font-weight: 700;
    opacity: 0.9;
  }

  .accept:hover {
    background: var(--color-tertiary-glow);
    box-shadow: 0 1px 6px var(--color-tertiary-glow);
  }

  .accept:active {
    box-shadow: 0 1px 12px var(--color-tertiary-glow);
  }

  .decline {
    background: var(--dialog-cancel-btn-bg);
    color: var(--dialog-text);
    opacity: 0.8;
  }

  .decline:hover {
    background: var(--dialog-cancel-btn-hover);
  }

  .decline:active {
    background: var(--dialog-cancel-btn-active);
    color: var(--text-active);
  }

  .loading {
    padding: 1rem;
    text-align: center;
    color: #999;
  }
</style>
