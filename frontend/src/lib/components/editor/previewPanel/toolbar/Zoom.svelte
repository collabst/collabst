<script lang="ts">
  import {
    currentZoomValue,
    currentZoomMode,
  } from "$lib/components/editor/context";
  import Button from "./Button.svelte";
  import GaleryVertical from "@lucide/svelte/icons/gallery-vertical";
  import GaleryHorizontal from "@lucide/svelte/icons/gallery-horizontal";
  import Brackets from "@lucide/svelte/icons/brackets";
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
      <GaleryHorizontal />
    {:else if $currentZoomMode === "fit-height"}
      <GaleryVertical />
    {:else if $currentZoomMode === "fit-page"}
      <Brackets />
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
</style>
