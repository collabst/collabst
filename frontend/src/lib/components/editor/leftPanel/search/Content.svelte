<script lang="ts">
  import { searchMatches } from "$lib/components/editor/context";
  import FileMatches from "./FileMatches.svelte";
</script>

<div class="content">
  {#each $searchMatches as fileMatches}
    <FileMatches {fileMatches} />
  {/each}
</div>

<style>
  .content {
    flex: 1;
    display: flex;
    align-items: center;
    flex-direction: column;
    overflow-y: auto;
    padding: 0 0 5rem;
    gap: var(--space-1);
  }
</style>
