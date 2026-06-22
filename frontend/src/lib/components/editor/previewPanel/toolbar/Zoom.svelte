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

  let dropdownOpen = $state(false);

  function handleClick(e: MouseEvent) {
    dropdownOpen = !dropdownOpen;
    if (dropdownOpen) {
      e.stopPropagation();
      window.addEventListener("click", handleClick);
    } else {
      window.removeEventListener("click", handleClick);
    }
  }
</script>

<div class="zoom">
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
