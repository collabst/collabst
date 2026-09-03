<script lang="ts">
  import {
    cancelInvitation,
    pendingInvitations,
    sendInvitation,
    sharingBusy,
  } from "../context";
  import Section from "../Section.svelte";
  import RoleSelect from "../RoleSelect.svelte";
  import Button from "../../Button.svelte";
  import IconButton from "../../IconButton.svelte";
  import RoleBadge from "../../RoleBadge.svelte";
  import SendHorizontal from "@lucide/svelte/icons/send-horizontal";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import type { CollaboratorRole } from "$lib/types";

  let email = $state("");
  let role = $state<CollaboratorRole>("writer");

  async function submit(event: Event) {
    event.preventDefault();
    if (await sendInvitation(email, role)) {
      email = "";
      role = "writer";
    }
  }
</script>

<Section title="Invite collaborators" icon={SendHorizontal}>
  <form class="invite" onsubmit={submit}>
    <input
      type="email"
      bind:value={email}
      placeholder="collaborator@example.com"
      disabled={$sharingBusy}
      aria-label="Email of the person to invite"
    />
    <RoleSelect
      value={role}
      disabled={$sharingBusy}
      ariaLabel="Role for the invitation"
      onchange={(next) => (role = next)}
    />
    <Button
      variant="primary"
      disabled={$sharingBusy || !email.trim()}
      onclick={submit}
    >
      Invite
    </Button>
  </form>

  {#if $pendingInvitations.length === 0}
    <p class="muted">No pending invitations.</p>
  {:else}
    {#each $pendingInvitations as invitation (invitation.id)}
      <div class="pending">
        <span class="email">{invitation.invitee_email}</span>
        <RoleBadge role={invitation.role} />
        <IconButton
          icon={Trash2}
          label="Cancel invitation"
          tone="danger"
          size={15}
          onclick={() => void cancelInvitation(invitation.id)}
        />
      </div>
    {/each}
  {/if}
</Section>

<style>
  .invite {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--border-primary);
    border-radius: 0.6rem;
    background-color: var(--bg-input);
    color: var(--text-primary);
    font: inherit;
    font-size: 0.85rem;
  }

  input:focus {
    border-color: var(--color-tertiary-500);
  }

  input::placeholder {
    color: var(--text-tertiary);
  }

  .pending {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .pending .email {
    flex: 1;
    min-width: 0;
    font-size: 0.825rem;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .muted {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-tertiary);
  }
</style>
