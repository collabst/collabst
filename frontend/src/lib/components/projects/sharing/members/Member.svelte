<script lang="ts">
  import type { Collaborator } from "$lib/types";
  import {
    canManageSharing,
    removeMember,
    shareProject,
    sharingBusy,
    updateMemberRole,
  } from "../context";
  import RoleSelect from "../RoleSelect.svelte";
  import RoleBadge from "../../RoleBadge.svelte";
  import IconButton from "../../IconButton.svelte";
  import UserMinus from "@lucide/svelte/icons/user-minus";

  interface Props {
    member: Collaborator;
  }

  let { member }: Props = $props();

  // The owner's row is never editable — demoting or removing them would leave
  // the project without one.
  let isOwner = $derived(
    member.role === "owner" || member.user_id === $shareProject?.owner_id,
  );
  let name = $derived(member.user?.display_name ?? member.user_id);
</script>

<div class="member">
  <div class="identity">
    <span class="name">{name}</span>
    {#if member.user?.email}<span class="email">{member.user.email}</span>{/if}
  </div>

  {#if $canManageSharing && !isOwner}
    <RoleSelect
      value={member.role}
      disabled={$sharingBusy}
      ariaLabel="Role of {name}"
      onchange={(role) => void updateMemberRole(member.user_id, role)}
    />
    <IconButton
      icon={UserMinus}
      label="Remove {name}"
      tone="danger"
      onclick={() => void removeMember(member.user_id)}
    />
  {:else}
    <RoleBadge role={isOwner ? "owner" : member.role} />
  {/if}
</div>

<style>
  .member {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .identity {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .email {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
