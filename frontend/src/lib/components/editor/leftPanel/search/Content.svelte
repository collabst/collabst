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
    padding: var(--space-2);
    flex-direction: column;
    gap: var(--space-4);
  }
</style>
