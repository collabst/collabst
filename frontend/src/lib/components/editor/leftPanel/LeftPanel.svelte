<script lang="ts">
  import Panel from "$lib/components/editor/Panel.svelte";
  import NavBar from "./navBar/NavBar.svelte";
  import TopBar from "./TopBar.svelte";
</script>

<Panel sizeWeight={0.5}>
  <div class="container">
    <TopBar />
    <NavBar />
  </div>
</Panel>

<style>
  .container {
    position: relative;
    height: 100%;
  }
</style>
