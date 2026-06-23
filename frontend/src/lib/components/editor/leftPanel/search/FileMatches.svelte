<script lang="ts">
  import {
    replaceAllInFile,
    type FileSearchMatches,
  } from "$lib/components/editor/context";
  import Button from "../Button.svelte";
  import ReplaceAll from "@lucide/svelte/icons/replace-all";
  import Match from "./Match.svelte";

  interface Props {
    fileMatches: FileSearchMatches;
  }

  let { fileMatches }: Props = $props();
</script>

<div class="file-matches">
  <div class="header">
  <div class="top">
    <div class="path">{fileMatches.filePath}</div>
    <div class="badge">{fileMatches.matches.length}</div>
    <Button onclick={() => replaceAllInFile(fileMatches.filePath)}>
      <ReplaceAll />
    </Button>
  </div>
  </div>
  <div class="match-list">
    {#each fileMatches.matches as match}
      <Match {match} />
    {/each}
  </div>
</div>

<style>
  .file-matches {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0 var(--space-2);
    color: var(--text-primary);
  }

  .header {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 0 var(--space-3);
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .path {
    font-weight: bold;
  }

  .badge {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    border-radius: 1rem;
    background-color: var(--surface-hover);
    font-size: 0.75rem;
    font-weight: bold;
    color: var(--text-secondary);
    padding: 0 0.5rem;
    margin-right: var(--space-2);
  }

  .match-list {
    display: flex;
    flex-direction: column;
    /* gap: var(--space-1); */
  }
</style>