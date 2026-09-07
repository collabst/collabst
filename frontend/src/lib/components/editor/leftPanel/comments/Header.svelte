<script lang="ts">
  import { comments } from "$lib/components/editor/context";
  import {
    showResolvedComments,
    toggleShowResolvedComments,
  } from "$lib/stores/preferences";
  import Button from "../Button.svelte";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";

  let unresolved = $derived($comments.filter((c) => !c.resolved).length);
</script>

<div class="header">
  <div class="title">
    <div class="name">Comments</div>
    {#if unresolved > 0}
      <div class="badge">{unresolved}</div>
    {/if}
  </div>
  <Button
    onclick={toggleShowResolvedComments}
    selected={$showResolvedComments}
    title={$showResolvedComments ? "Hide resolved" : "Show resolved"}
  >
    {#if $showResolvedComments}
      <Eye />
    {:else}
      <EyeOff />
    {/if}
  </Button>
</div>

<style>
  .header {
    width: 100%;
    padding: 1.5rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .name {
    font-size: 1.75rem;
    font-weight: bold;
    letter-spacing: -0.03em;
  }

  .badge {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    border-radius: 1rem;
    background-color: var(--surface-hover);
    font-size: 0.68rem;
    font-weight: bold;
    color: var(--text-secondary);
    padding: 0 0.5rem;
  }
</style>
