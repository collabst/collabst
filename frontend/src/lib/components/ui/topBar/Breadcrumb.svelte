<script lang="ts">
  import {
    selectedAsset,
    selectedFile,
  } from "$lib/components/editor/context";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  // The open document's path, split for display. Assets and files share the
  // slot: only one of them is ever selected.
  let segments = $derived.by(() => {
    const path = $selectedFile?.path ?? $selectedAsset?.path ?? "";
    return path.split("/").filter(Boolean);
  });
</script>

{#if segments.length > 0}
  <nav class="breadcrumb" aria-label="Open file">
    {#each segments as segment, index (index)}
      {#if index > 0}<ChevronRight size={13} />{/if}
      <span class="segment" class:last={index === segments.length - 1}>
        {segment}
      </span>
    {/each}
  </nav>
{/if}

<style>
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    min-width: 0;
    margin-left: 0.75rem;
    overflow: hidden;
    color: var(--text-tertiary);
  }

  .segment {
    font-size: 0.8rem;
    color: var(--text-tertiary);
    white-space: nowrap;
  }

  .segment.last {
    color: var(--text-secondary);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
