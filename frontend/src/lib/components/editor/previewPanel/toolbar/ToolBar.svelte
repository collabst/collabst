<script lang="ts">
  import Button from "./Button.svelte";
  import Export from "./Export.svelte";
  import Separator from "./Separator.svelte";
  import Status from "./Status.svelte";
  import Zoom from "./Zoom.svelte";
  import OverflowBar, {
    type OverflowItem,
  } from "$lib/components/ui/OverflowBar.svelte";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
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

  // Zoom stays longest: the status line and the window controls are the ones a
  // narrow preview can do without first.
  const controls: OverflowItem[] = $derived([
    { render: zoomOutControl, label: "Zoom out" },
    { render: zoomControl, label: "Zoom", submenu: true },
    { render: zoomInControl, label: "Zoom in" },
    { render: separator, separator: true },
    { render: statusControl },
    { render: separator, separator: true },
    { render: exportControl, label: "Export", submenu: true },
    { render: separator, separator: true },
    {
      render: windowControl,
      label: $separatePreviewOpen
        ? "Back to split view"
        : "Open in a separate window",
    },
  ]);
</script>

{#snippet separator()}
  <Separator />
{/snippet}

{#snippet zoomOutControl()}
  <Button onclick={zoomOut} title="Zoom out"><Minus /></Button>
{/snippet}

{#snippet zoomControl()}
  <Zoom />
{/snippet}

{#snippet zoomInControl()}
  <Button onclick={zoomIn} title="Zoom in"><Plus /></Button>
{/snippet}

{#snippet statusControl()}
  <Status />
{/snippet}

{#snippet exportControl()}
  <Export />
{/snippet}

{#snippet windowControl()}
  {#if $separatePreviewOpen}
    <Button onclick={closeSeparatePreview} title="Back to split view">
      <Columns2 />
    </Button>
  {:else}
    <Button onclick={openSeparatePreview} title="Open in a separate window">
      <ExternalLink />
    </Button>
  {/if}
{/snippet}

{#snippet more({ onclick }: { onclick: (e: MouseEvent) => void })}
  <Button {onclick} title="More options">
    <Ellipsis />
  </Button>
{/snippet}

<div class="container">
  <OverflowBar class="preview-tool-bar" items={controls} {more} />
</div>

<style>
  .container {
    position: absolute;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  /* `OverflowBar` owns the element; see the note on `.nav-bar`. */
  :global(.overflow-bar.preview-tool-bar) {
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
