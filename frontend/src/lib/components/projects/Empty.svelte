<script lang="ts">
  import { isFiltering } from "./context";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import SearchX from "@lucide/svelte/icons/search-x";
</script>

<div class="empty">
  {#if $isFiltering}
    <SearchX size={32} />
    <p class="title">No matching project</p>
    <p class="detail">Nothing here matches your search.</p>
  {:else}
    <FolderOpen size={32} />
    <p class="title">No projects yet</p>
    <p class="detail">Create your first project to get started.</p>
  {/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 5rem 1rem;
    color: var(--text-tertiary);
  }

  .title {
    margin: 0.5rem 0 0 0;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .detail {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
</style>
