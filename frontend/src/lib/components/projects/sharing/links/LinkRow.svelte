<script lang="ts">
  import {
    absoluteShareUrl,
    canManageSharing,
    copyShareLink,
    createPublicLink,
    publicLinks,
    revokePublicLink,
    sharingBusy,
    type PublicLinkType,
  } from "../context";
  import Button from "../../Button.svelte";
  import IconButton from "../../IconButton.svelte";
  import Copy from "@lucide/svelte/icons/copy";

  interface Props {
    linkType: { key: PublicLinkType; label: string };
  }

  let { linkType }: Props = $props();

  let link = $derived($publicLinks[linkType.key]);
</script>

<div class="row">
  <span class="label">{linkType.label}</span>

  {#if link}
    <input class="url" readonly value={absoluteShareUrl(link.url)} />
    <IconButton
      icon={Copy}
      label="Copy link"
      size={15}
      onclick={() => void copyShareLink(link.url)}
    />
    {#if $canManageSharing}
      <Button
        variant="danger"
        disabled={$sharingBusy}
        onclick={() => void revokePublicLink(linkType.key)}
      >
        Revoke
      </Button>
    {/if}
  {:else if $canManageSharing}
    <Button
      disabled={$sharingBusy}
      onclick={() => void createPublicLink(linkType.key)}
    >
      Create link
    </Button>
  {:else}
    <span class="muted">No link</span>
  {/if}
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .label {
    width: 6rem;
    flex-shrink: 0;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .url {
    flex: 1;
    min-width: 0;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border-primary);
    border-radius: 0.6rem;
    background-color: transparent;
    color: var(--text-tertiary);
    font: inherit;
    font-size: 0.8rem;
    text-overflow: ellipsis;
  }

  .muted {
    font-size: 0.8rem;
    color: var(--text-tertiary);
  }
</style>
