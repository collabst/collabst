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
    <Button onclick={() => replaceAllInFile(fileMatches.filePath)}>
      <ReplaceAll />
    </Button>
  </div>
    <div class="match-count">
      {fileMatches.matches.length}
      {fileMatches.matches.length === 1 ? "match" : "matches"}
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
  }

  .header {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .path {
    font-weight: bold;
  }

  .match-count {
    font-size: 0.7rem;
  }

  .match-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
</style>