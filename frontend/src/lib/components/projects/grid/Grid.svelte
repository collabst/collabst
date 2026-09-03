<script lang="ts">
  import { visibleProjects } from "../context";
  import Card from "./Card.svelte";
  import Empty from "../Empty.svelte";
</script>

{#if $visibleProjects.length === 0}
  <Empty />
{:else}
  <div class="grid">
    {#each $visibleProjects as project (project.id)}
      <Card {project} />
    {/each}
  </div>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1rem;
    padding: 0.5rem 0 2rem 0;
  }
</style>
