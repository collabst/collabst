<script lang="ts">
  import { ToolButton, Tooltip } from "$lib/components/ui";
  import Plus from "@lucide/svelte/icons/plus";
  import Minus from "@lucide/svelte/icons/minus";
  import Download from "@lucide/svelte/icons/download";

  export let previewHtml: string = "";
  export let onDownloadPDF: (() => void) | null = null;

  function zoomIn() {
    const previewArea = document.querySelector(
      ".preview-area > .typst-doc"
    ) as HTMLElement;
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
    const previewArea = document.querySelector(
      ".preview-area > .typst-doc"
    ) as HTMLElement;
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

  function downloadPDF() {
    if (onDownloadPDF) {
      onDownloadPDF();
    }
  }
</script>

<div class="preview-pane">
  <div class="preview-header">
    <div class="zoom-controls">
      <Tooltip text="Zoom out" position="bottom">
        <ToolButton icon={Minus} onclick={zoomOut} position="first" />
      </Tooltip>
      <Tooltip text="Zoom in" position="bottom">
        <ToolButton icon={Plus} onclick={zoomIn} position="last" />
      </Tooltip>
    </div>
    <div class="download-controls">
      <Tooltip text="Download PDF" position="bottom">
        <ToolButton icon={Download} onclick={downloadPDF} />
      </Tooltip>
    </div>
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
    padding-bottom: var(--space-2);
  }

  .zoom-controls {
    display: flex;
  }

  .preview-area {
    height: 100%;
    width: 100%;
    box-sizing: border-box;
    padding: 0px;
    background-color: var(--bg-file-panel);
    overflow: auto;
    display: flex;
    justify-content: center;
  }

  .download-controls {
    margin-left: auto;
    display: flex;
  }

  :global(.typst-doc) {
    background-color: var(--bg-typst-doc);
  }
</style>
