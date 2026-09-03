<script lang="ts">
  import { setViewMode, viewMode } from "./context";
  import Button from "./Button.svelte";
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import List from "@lucide/svelte/icons/list";
</script>

<div class="toggle">
  <Button
    selected={$viewMode === "grid"}
    onclick={() => setViewMode("grid")}
    title="Grid view"
    ariaLabel="Grid view"
  >
    <LayoutGrid size={16} />
  </Button>
  <Button
    selected={$viewMode === "list"}
    onclick={() => setViewMode("list")}
    title="List view"
    ariaLabel="List view"
  >
    <List size={16} />
  </Button>
</div>

<style>
  .toggle {
    display: flex;
    gap: 0.25rem;
  }
</style>
