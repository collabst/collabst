<script lang="ts">
  import { ToolButton, DropdownToolButton, Tooltip } from "$lib/components/ui";
  import Plus from "@lucide/svelte/icons/plus";
  import Minus from "@lucide/svelte/icons/minus";
  import MoveHorizontal from "@lucide/svelte/icons/move-horizontal";
  import MoveVertical from "@lucide/svelte/icons/move-vertical";
  import File from "@lucide/svelte/icons/file";
  import Download from "@lucide/svelte/icons/download";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { Component } from 'svelte';
  import { theme as themeStore } from '$lib/stores/theme';

  interface PreviewPaneProps {
    previewHtml?: string;
    onDownloadPDF?: (() => void) | null;
    negativePreview?: boolean;
    panelWidth?: number;
    showToolbar?: boolean;
  }

  let {
    previewHtml = "",
    onDownloadPDF = null,
    negativePreview = false,
    panelWidth = 0,
    showToolbar = true
  }: PreviewPaneProps = $props();

  type ZoomMode = 'fit-width' | 'fit-height' | 'fit-page' | 'custom';
  
  let currentZoomScale = $state(1);
  let currentZoomMode = $state<ZoomMode>('custom');
  let currentTheme = $state<'light' | 'dark'>($themeStore);
  
  // Subscribe to theme changes
  $effect(() => {
    currentTheme = $themeStore;
  });
  
  // Compute whether to apply negative filter (only in dark theme)
  let shouldApplyNegativeFilter = $derived(negativePreview && currentTheme === 'dark');
  
  // Watch for panel width changes and recalculate zoom if in fit mode
  $effect(() => {
    if (panelWidth > 0 && (currentZoomMode === 'fit-width' || currentZoomMode === 'fit-page')) {
      // Slight delay to allow DOM to update
      setTimeout(() => {
        if (currentZoomMode === 'fit-width') {
          fitToWidth();
        } else if (currentZoomMode === 'fit-page') {
          fitToPage();
        }
      }, 10);
    }
  })
  
  // Dynamic icon/text for zoom button
  const zoomButtonDisplay = $derived<Component | string>(
    currentZoomMode === 'fit-width' ? MoveHorizontal :
    currentZoomMode === 'fit-height' ? MoveVertical :
    currentZoomMode === 'fit-page' ? File :
    `${Math.round(currentZoomScale * 100)}%`
  );

  function setZoom(scale: number, mode: ZoomMode = 'custom') {
    const previewArea = document.querySelector(
      ".preview-area > .typst-doc"
    ) as HTMLElement;
    if (previewArea) {
      previewArea.style.setProperty("--zoom-scale", scale.toString());
      previewArea.style.transform = `scale(${scale})`;
      previewArea.style.transformOrigin = "top center";
      currentZoomScale = scale;
      currentZoomMode = mode;
    }
  }

  function zoomIn() {
    const newScale = currentZoomScale + 0.1;
    setZoom(newScale, 'custom');
  }

  function zoomOut() {
    const newScale = Math.max(0.1, currentZoomScale - 0.1);
    setZoom(newScale, 'custom');
  }

  function fitToWidth() {
    const previewArea = document.querySelector(".preview-area") as HTMLElement;
    const typstDoc = document.querySelector(".preview-area > .typst-doc") as HTMLElement;
    if (previewArea && typstDoc) {
      const containerWidth = previewArea.clientWidth;
      const docWidth = typstDoc.scrollWidth;
      const scale = (containerWidth - 40) / docWidth; // 40px padding
      setZoom(scale, 'fit-width');
    }
  }

  function fitToHeight() {
    const previewArea = document.querySelector(".preview-area") as HTMLElement;
    const typstDoc = document.querySelector(".preview-area > .typst-doc") as HTMLElement;
    if (previewArea && typstDoc) {
      const containerHeight = previewArea.clientHeight;
      const docHeight = typstDoc.scrollHeight;
      const scale = (containerHeight - 40) / docHeight; // 40px padding
      setZoom(scale, 'fit-height');
    }
  }

  function fitToPage() {
    const previewArea = document.querySelector(".preview-area") as HTMLElement;
    const typstDoc = document.querySelector(".preview-area > .typst-doc") as HTMLElement;
    if (previewArea && typstDoc) {
      const containerWidth = previewArea.clientWidth;
      const containerHeight = previewArea.clientHeight;
      const docWidth = typstDoc.scrollWidth;
      const docHeight = typstDoc.scrollHeight;
      const scaleWidth = (containerWidth - 40) / docWidth;
      const scaleHeight = (containerHeight - 40) / docHeight;
      const scale = Math.min(scaleWidth, scaleHeight);
      setZoom(scale, 'fit-page');
    }
  }

  const zoomItems = [
    { label: "Fit to width", icon: MoveHorizontal, onclick: fitToWidth },
    { label: "Fit to height", icon: MoveVertical, onclick: fitToHeight },
    { label: "Fit to page", icon: File, onclick: fitToPage, separator: true },
    { label: "25%", onclick: () => setZoom(0.25, 'custom') },
    { label: "50%", onclick: () => setZoom(0.5, 'custom') },
    { label: "75%", onclick: () => setZoom(0.75, 'custom') },
    { label: "100%", onclick: () => setZoom(1, 'custom') },
    { label: "200%", onclick: () => setZoom(2, 'custom') },
    { label: "300%", onclick: () => setZoom(3, 'custom') },
  ];

  function exportAsPDF() {
    if (onDownloadPDF) {
      onDownloadPDF();
    }
  }

  function exportAsPNG() {
    console.log("Export as PNG - Not implemented yet");
    // TODO: Implement PNG export
  }

  function exportAsSVG() {
    console.log("Export as SVG - Not implemented yet");
    // TODO: Implement SVG export
  }

  function exportSourcesAsZip() {
    console.log("Export sources as ZIP - Not implemented yet");
    // TODO: Implement ZIP export
  }

  const exportItems = [
    { label: "Export as PDF", onclick: exportAsPDF },
    { label: "Export as PNG", onclick: exportAsPNG },
    { label: "Export as SVG", onclick: exportAsSVG, separator: true },
    { label: "Export sources as ZIP", onclick: exportSourcesAsZip },
  ];

  function downloadPDF() {
    if (onDownloadPDF) {
      onDownloadPDF();
    }
  }
</script>

<div class="preview-pane">
  {#if showToolbar}
  <div class="preview-header">
    <div class="zoom-controls">
      <Tooltip text="Zoom out" position="bottom">
        <ToolButton icon={Minus} onclick={zoomOut} position="first" />
      </Tooltip>
      <Tooltip text="Zoom options" position="bottom">
        <DropdownToolButton 
          icon={zoomButtonDisplay} 
          items={zoomItems} 
          position="middle"
          buttonWidth="45px"
          buttonBackground="var(--bg-top-bar)"
          allowIconOverflow={false}
        />
      </Tooltip>
      <Tooltip text="Zoom in" position="bottom">
        <ToolButton icon={Plus} onclick={zoomIn} position="last" />
      </Tooltip>
      
    </div>
    <div class="download-controls">
      <Tooltip text="Export PDF" position="bottom">
        <ToolButton icon={Download} onclick={downloadPDF} position="first"/>
      </Tooltip>
      <Tooltip text="Export..." position="bottom">
        <DropdownToolButton 
          icon={ChevronDown} 
          items={exportItems} 
          position="last"
          buttonWidth="20px"
        />
      </Tooltip>
    </div>
  </div>
  {/if}
  <div class="preview-area" class:negative-filter={shouldApplyNegativeFilter}>
    {@html previewHtml}
  </div>
</div>

<style>
  .preview-pane {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: visible;
  }

  .preview-header {
    height: 40px;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: var(--space-2);
    overflow: visible;
  }

  .zoom-controls {
    display: flex;
    overflow: visible;
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

  :global(.negative-filter .typst-doc) {
    filter: invert(1);
  }
</style>
