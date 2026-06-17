<script lang="ts">
  import Button from "./Button.svelte";
  import Zoom from "./Zoom.svelte";
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";
  import { zoomIn, zoomOut } from "$lib/components/editor/context";
</script>

<div class="container">
  <div class="tool-bar">
    <Button onclick={zoomOut}><Minus /></Button>
    <Zoom />
    <Button onclick={zoomIn}><Plus /></Button>
  </div>
</div>

<style>
  .container {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .tool-bar {
    display: flex;
    background-color: var(--bg-primary);
    padding: 0.2rem 0.75rem;
    border: 1px solid var(--border-primary);
    border-radius: 0.5rem;
    margin: 0.5rem;
  }
</style>
