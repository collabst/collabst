<script lang="ts">
  import { sortBy, sortByColumn, visibleProjects } from "../context";
  import Row from "./Row.svelte";
  import Empty from "../Empty.svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
</script>

{#if $visibleProjects.length === 0}
  <Empty />
{:else}
  <div class="list">
    <div class="header">
      <button class="header-cell" onclick={() => sortByColumn("name")}>
        Project
        {#if $sortBy === "name"}<ChevronDown size={15} />{/if}
      </button>
      <div class="header-cell"></div>
      <button class="header-cell" onclick={() => sortByColumn("created")}>
        Created
        {#if $sortBy === "created"}<ChevronDown size={15} />{/if}
      </button>
      <button class="header-cell" onclick={() => sortByColumn("modified")}>
        Last modified
        {#if $sortBy === "modified"}<ChevronDown size={15} />{/if}
      </button>
    </div>

    {#each $visibleProjects as project (project.id)}
      <Row {project} />
    {/each}
  </div>
{/if}

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding-bottom: 2rem;
  }

  .header {
    display: grid;
    grid-template-columns: minmax(0, 2fr) 7rem minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
    padding: 0.4rem 0.85rem 0.6rem 0.85rem;
    border-bottom: 1px solid var(--editor-panels-border);
    margin-bottom: 0.25rem;
  }

  .header-cell {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-align: left;
    text-transform: uppercase;
    cursor: pointer;
  }

  button.header-cell:hover {
    color: var(--text-primary);
  }
</style>
