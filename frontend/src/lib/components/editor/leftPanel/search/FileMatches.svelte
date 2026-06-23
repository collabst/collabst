<script lang="ts">
  import {
    replaceAllInFile,
    type FileSearchMatches,
    toggleFileCollapsed,
  } from "$lib/components/editor/context";
  import Button from "../Button.svelte";
  import ReplaceAll from "@lucide/svelte/icons/replace-all";
  import Match from "./Match.svelte";

  interface Props {
    fileMatches: FileSearchMatches;
  }

  let { fileMatches }: Props = $props();
  let collapsed = $derived(fileMatches.collapsed);
  let fileName = $derived(fileMatches.filePath.split("/").pop() || fileMatches.filePath);
</script>

<div class="file-matches">
  <div class="header">
    <button class="top" onclick={() => toggleFileCollapsed(fileMatches)}>
    <div class="left">
      <div class="name">{fileName}</div>
      <div class="path">{fileMatches.filePath}</div>
    </div>
      <div class="right">
        <div class="badge">{fileMatches.matches.length}</div>
        <Button
          onclick={(e) => {
            e.stopPropagation();
            replaceAllInFile(fileMatches.filePath);
          }}
        >
          <ReplaceAll />
        </Button>
      </div>
    </button>
  </div>
  {#if !collapsed}
    <div class="match-list">
      {#each fileMatches.matches as match}
        <Match {match} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .file-matches {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0 var(--space-2);
    color: var(--text-primary);
  }

  .header {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 0.25rem var(--space-3);
    border-radius: 6px;
  }

  .header:hover {
    background-color: var(--surface-hover);
  }

  .header:active {
    background-color: var(--surface-active);
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: transparent;
    border: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
  }

  .left {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .name {
    font-weight: bold;
    font-size: 0.75rem;
    color: var(--text-primary);
  }

  .path {
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }

  .right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
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
  }

  .match-list {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
</style>
