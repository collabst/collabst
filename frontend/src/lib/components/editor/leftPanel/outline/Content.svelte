<script lang="ts">
  import { outline, selectedFile } from "$lib/components/editor/context";
  import Entry from "./Entry.svelte";
</script>

<div class="content">
  {#each $outline as entry (entry.id)}
    <Entry {entry} />
  {/each}

  {#if $outline.length === 0}
    <div class="empty">
      {#if $selectedFile?.name.toLowerCase().endsWith(".typ")}
        No headings in this document.
      {:else}
        Open a Typst document to see its outline.
      {/if}
    </div>
  {/if}
</div>

<style>
  .content {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding: 3px 0 5rem;
  }

  .empty {
    padding: 1rem 1.5rem;
    color: var(--text-tertiary);
    font-size: 0.85rem;
  }
</style>
