<script lang="ts">
  import type { Invitation } from "$lib/types";
  import {
    acceptInvitation,
    answeringInvitation,
    declineInvitation,
  } from "../context";
  import Button from "../Button.svelte";
  import RoleBadge from "../RoleBadge.svelte";

  interface Props {
    invitation: Invitation;
  }

  let { invitation }: Props = $props();

  let busy = $derived($answeringInvitation === invitation.id);
</script>

<div class="invitation">
  <div class="info">
    <RoleBadge role={invitation.role} />
    <span class="email">{invitation.invitee_email}</span>
    <span class="date">
      {new Date(invitation.created_at).toLocaleDateString()}
    </span>
  </div>
  <div class="actions">
    <Button
      variant="primary"
      disabled={busy}
      onclick={() => void acceptInvitation(invitation.id)}
    >
      Accept
    </Button>
    <Button disabled={busy} onclick={() => void declineInvitation(invitation.id)}>
      Decline
    </Button>
  </div>
</div>

<style>
  .invitation {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.75rem 1rem;
    border: 1px solid var(--editor-panels-border);
    border-radius: 0.9rem;
    background-color: color-mix(in srgb, var(--bg-editor), transparent 45%);
  }

  .info {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
    flex: 1;
  }

  .email {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .date {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    white-space: nowrap;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }
</style>
