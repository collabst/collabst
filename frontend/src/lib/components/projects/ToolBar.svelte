<script lang="ts">
  import NewProjectButton from "./NewProjectButton.svelte";
  import Search from "./Search.svelte";
  import ViewToggle from "./ViewToggle.svelte";
  import SortMenu from "./SortMenu.svelte";
</script>

<div class="toolbar">
  <NewProjectButton />
  <div class="right">
    <Search />
    <ViewToggle />
    <SortMenu />
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }

  .right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
  }
</style>
