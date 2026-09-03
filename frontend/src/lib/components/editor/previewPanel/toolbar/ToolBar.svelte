<script lang="ts">
  import Button from "./Button.svelte";
  import Export from "./Export.svelte";
  import Separator from "./Separator.svelte";
  import Status from "./Status.svelte";
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
    <Separator />
    <Status />
    <Separator />
    <Export />
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
    align-items: center;
    background-color: var(--bg-primary);
    padding: 0.2rem 0.35rem;
    border: 1px solid var(--border-primary);
    border-radius: 0.5rem;
    margin: 0.5rem;
    gap: 0.2rem;
    max-width: calc(100% - 1rem);
  }
</style>
