<script lang="ts">
  import {
    canManageSharing,
    closeShareDialog,
    shareProject,
    sharingError,
    sharingLoading,
    sharingOverview,
  } from "./context";
  import Dialog from "../Dialog.svelte";
  import Links from "./links/Links.svelte";
  import Members from "./members/Members.svelte";
  import Invite from "./invitations/Invite.svelte";
</script>

{#if $shareProject}
  <Dialog
    title="Share “{$shareProject.name}”"
    onclose={closeShareDialog}
    width="38rem"
  >
    {#if $sharingLoading && !$sharingOverview}
      <p class="notice">Loading sharing settings…</p>
    {:else if $sharingError}
      <p class="notice error">{$sharingError}</p>
    {:else if $sharingOverview}
      <Links />
      {#if $canManageSharing}
        <Invite />
      {/if}
      <Members />
    {/if}
  </Dialog>
{/if}

<style>
  .notice {
    margin: 0;
    padding: 1.5rem 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .notice.error {
    color: var(--color-error);
  }
</style>
