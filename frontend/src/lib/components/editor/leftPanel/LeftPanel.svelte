<script lang="ts">
  import Panel from "$lib/components/editor/Panel.svelte";
  import NavBar from "./navBar/NavBar.svelte";
  import Header from "./header/Header.svelte";
  import Content from "./content/Content.svelte";
</script>

<Panel sizeWeight={0.5}>
  <div class="container">
    <Header />
    <Content />
    <NavBar />
  </div>
</Panel>

<style>
  .container {
    position: relative;
    height: 100%;
  }
</style>
