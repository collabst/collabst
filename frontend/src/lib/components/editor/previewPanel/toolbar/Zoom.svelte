<script lang="ts">
  import {
    currentZoomValue,
    currentZoomMode,
  } from "$lib/components/editor/context";
  import Button from "./Button.svelte";
  import MoveHorizontal from "@lucide/svelte/icons/move-horizontal";
  import MoveVertical from "@lucide/svelte/icons/move-vertical";
  import FileIcon from "@lucide/svelte/icons/file";
  import ZoomDropdown from "./ZoomDropdown.svelte";

  let element: HTMLDivElement | undefined = $state();
  let dropdownOpen = $state(false);

  function handleClick(e: MouseEvent) {
    dropdownOpen = !dropdownOpen;
    // Whichever document the toolbar was mounted into: in the separate preview
    // window it is not the one `window` refers to.
    const view = element?.ownerDocument.defaultView ?? window;
    if (dropdownOpen) {
      e.stopPropagation();
      view.addEventListener("click", handleClick);
    } else {
      view.removeEventListener("click", handleClick);
    }
  }
</script>

<div class="zoom" bind:this={element}>
  <Button onclick={handleClick}>
    {#if $currentZoomMode === "custom"}
      {($currentZoomValue * 100).toFixed(0)}%
    {:else if $currentZoomMode === "fit-width"}
      <MoveHorizontal />
    {:else if $currentZoomMode === "fit-height"}
      <MoveVertical />
    {:else if $currentZoomMode === "fit-page"}
      <FileIcon />
    {/if}
  </Button>
  <ZoomDropdown open={dropdownOpen} />
</div>

<style>
  .zoom {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    font-size: 0.875rem;
    font-weight: 500;
    flex-direction: column;
  }

  /* .zoom:active {
    transform: scaleY(0.95) scaleX(1.05);
  } */
</style>
