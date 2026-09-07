<script lang="ts">
  import Button from "./Button.svelte";
  import Download from "@lucide/svelte/icons/download";
  import ExportDropdown from "./ExportDropdown.svelte";

  let element: HTMLDivElement | undefined = $state();
  let dropdownOpen = $state(false);

  // Same one-shot window listener the zoom dropdown uses: the next click
  // anywhere closes the menu, including the one that picked an item.
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

<div class="export" bind:this={element}>
  <Button onclick={handleClick}><Download /></Button>
  <ExportDropdown open={dropdownOpen} />
</div>

<style>
  .export {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  }
</style>
