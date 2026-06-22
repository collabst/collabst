<script lang="ts">
  import Panel from "$lib/components/editor/Panel.svelte";
  import NavBar from "./navBar/NavBar.svelte";
  import Content from "./Content.svelte";
</script>

<Panel sizeWeight={0.5}>
  <div class="container">
    <Content />
    <NavBar />
  </div>
</Panel>

<style>
  .container {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
</style>
