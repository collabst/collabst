<script lang="ts">
  import Button from "./Button.svelte";
  import Download from "@lucide/svelte/icons/download";
  import ExportDropdown from "./ExportDropdown.svelte";

  let dropdownOpen = $state(false);

  // Same one-shot window listener the zoom dropdown uses: the next click
  // anywhere closes the menu, including the one that picked an item.
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

<div class="export">
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
