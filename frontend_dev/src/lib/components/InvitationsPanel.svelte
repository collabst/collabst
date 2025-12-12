<script lang="ts">
  import { onMount } from 'svelte'
  import { invitationsApi } from '../services/api'
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

  async function handleAccept(id: number) {
    try {
      await invitationsApi.accept(id)
      loadInvitations()
      window.location.reload()
    } catch (error) {
      console.error('Failed to accept invitation:', error)
      alert('Failed to accept invitation')
    }
  }

  async function handleDecline(id: number) {
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
            <div class="role">{invitation.role.toUpperCase()}</div>
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
    background: rgba(255, 152, 0, 0.12);
    border: 1px solid rgba(255, 152, 0, 0.4);
    border-radius: 6px;
    margin-bottom: 1rem;
    overflow: hidden;
  }

  .header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgba(255, 152, 0, 0.3);
  }

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #ffb74d;
  }

  .list {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .invitation {
    background: #252526;
    padding: 1rem;
    border-radius: 4px;
    border: 1px solid #3e3e42;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s;
  }

  .invitation:hover {
    background: #2d2d30;
    border-color: #555;
  }

  .info {
    flex: 1;
  }

  .role {
    display: inline-block;
    background: rgba(14, 99, 156, 0.3);
    color: #4fc3f7;
    border: 1px solid rgba(79, 195, 247, 0.3);
    padding: 0.25rem 0.625rem;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 0.5rem;
    letter-spacing: 0.5px;
  }

  .email {
    font-size: 13px;
    color: #e8e8e8;
    margin-bottom: 0.25rem;
  }

  .date {
    font-size: 12px;
    color: #999;
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
    background: rgba(76, 175, 80, 0.2);
    color: #81c784;
    border-color: rgba(129, 199, 132, 0.4);
  }

  .accept:hover {
    background: rgba(76, 175, 80, 0.3);
    border-color: rgba(129, 199, 132, 0.6);
  }

  .decline {
    background: rgba(244, 67, 54, 0.2);
    color: #e57373;
    border-color: rgba(229, 115, 115, 0.4);
  }

  .decline:hover {
    background: rgba(244, 67, 54, 0.3);
    border-color: rgba(229, 115, 115, 0.6);
  }

  .loading {
    padding: 1rem;
    text-align: center;
    color: #999;
  }
</style>
