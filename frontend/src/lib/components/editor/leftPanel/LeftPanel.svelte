<script lang="ts">
  import Panel from "$lib/components/editor/Panel.svelte";
  import NavBar from "./navBar/NavBar.svelte";
  import Content from "./Content.svelte";
  import { leftPanelWidth } from "$lib/components/editor/context";
</script>

<Panel width={$leftPanelWidth}>
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
