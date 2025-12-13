<script lang="ts">
  import { IconButton, Tooltip } from "$lib/components/ui";
  import Plus from "@lucide/svelte/icons/plus";
  import Minus from "@lucide/svelte/icons/minus";

  export let previewHtml: string = "";

  function zoomIn() {
    const previewArea = document.querySelector(".preview-area > .typst-doc") as HTMLElement;
    if (previewArea) {
      const currentScale = parseFloat(
        getComputedStyle(previewArea).getPropertyValue("--zoom-scale") || "1"
      );
      const newScale = currentScale + 0.1;
      previewArea.style.setProperty("--zoom-scale", newScale.toString());
      previewArea.style.transform = `scale(${newScale})`;
      previewArea.style.transformOrigin = "top center";
    }
  }

  function zoomOut() {
    const previewArea = document.querySelector(".preview-area > .typst-doc") as HTMLElement;
    if (previewArea) {
      const currentScale = parseFloat(
        getComputedStyle(previewArea).getPropertyValue("--zoom-scale") || "1"
      );
      const newScale = Math.max(0.1, currentScale - 0.1);
      previewArea.style.setProperty("--zoom-scale", newScale.toString());
      previewArea.style.transform = `scale(${newScale})`;
      previewArea.style.transformOrigin = "top center";
    }
  }
</script>

<div class="preview-pane">
  <div class="preview-header">
    <Tooltip text="Zoom in" position="bottom">
      <IconButton
        class="button"
        icon={Plus}
        onclick={zoomIn}
        size="sm"
        variant="ghost"
      />
    </Tooltip>

    <Tooltip text="Zoom out" position="bottom">
      <IconButton
        class="button"
        icon={Minus}
        onclick={zoomOut}
        size="sm"
        variant="ghost"
      />
    </Tooltip>
  </div>
  <div class="preview-area">
    {@html previewHtml}
  </div>
</div>

<style>
  .preview-pane {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .preview-header {
    height: 40px;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .preview-area {
    height: 100%;
    width: 100%;
    box-sizing: border-box;
    padding: 16px;
    background-color: var(--bg-preview);
    overflow: auto;
    display: flex;
    justify-content: center;
  }

  :global(.typst-doc) {
    background-color: var(--bg-typst-doc);
  }
</style>
