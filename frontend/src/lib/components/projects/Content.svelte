<script lang="ts">
  import { viewMode } from "./context";
  import Grid from "./grid/Grid.svelte";
  import List from "./list/List.svelte";
</script>

{#if $viewMode === "grid"}
  <Grid />
{:else}
  <List />
{/if}
