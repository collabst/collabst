<script lang="ts">
  import Header from "./Header.svelte";
  import Content from "./Content.svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import DeleteConfirm from "./DeleteConfirm.svelte";
</script>

<div class="files">
  <Header />
  <Content />
  <ContextMenu />
  <DeleteConfirm />
</div>

<style>
  .files {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
</style>
