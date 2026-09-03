<script lang="ts">
  import Button from "./Button.svelte";
  import Export from "./Export.svelte";
  import Separator from "./Separator.svelte";
  import Status from "./Status.svelte";
  import Zoom from "./Zoom.svelte";
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";
  import Columns2 from "@lucide/svelte/icons/columns-2";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import {
    closeSeparatePreview,
    openSeparatePreview,
    separatePreviewOpen,
    zoomIn,
    zoomOut,
  } from "$lib/components/editor/context";
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
    <Separator />
    {#if $separatePreviewOpen}
      <Button onclick={closeSeparatePreview} title="Back to split view">
        <Columns2 />
      </Button>
    {:else}
      <Button onclick={openSeparatePreview} title="Open in a separate window">
        <ExternalLink />
      </Button>
    {/if}
  </div>
</div>

<style>
  .container {
    position: absolute;
    /* Above the separate-window overlay, which covers the idle iframe. */
    z-index: 3;
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
