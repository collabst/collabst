<script lang="ts">
  import { ToolButton, DropdownToolButton, Tooltip } from "$lib/components/ui";
  import Plus from "@lucide/svelte/icons/plus";
  import Minus from "@lucide/svelte/icons/minus";
  import MoveHorizontal from "@lucide/svelte/icons/move-horizontal";
  import MoveVertical from "@lucide/svelte/icons/move-vertical";
  import File from "@lucide/svelte/icons/file";
  import Columns2 from "@lucide/svelte/icons/columns-2";
  import Share2 from "@lucide/svelte/icons/share-2";
  import Download from "@lucide/svelte/icons/download";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import { saveLayoutState, loadLayoutState } from '$lib/utils/layoutStorage';
  import { browser } from '$app/environment';
  import TypstCanvas from './TypstCanvas.svelte';
  import type { Core } from '@mudomi/onykia-engine';

  type ZoomMode = 'fit-width' | 'fit-height' | 'fit-page' | 'custom';

  interface Props {
    // Shared engine
    core: Core | null;
    negative?: boolean;
    onCloseSeparatePreview?: () => void;
    onExportPDF?: () => void;
    onExportPNG?: () => void;
    onExportSVG?: () => void;
    onExportSourcesAsZip?: () => void;
    onOpenShare?: () => void;
  }

  let {
    core,
    negative = false,
    onCloseSeparatePreview = () => {},
    onExportPDF = () => {},
    onExportPNG = () => {},
    onExportSVG = () => {},
    onExportSourcesAsZip = () => {},
    onOpenShare = () => {},
  }: Props = $props();

  let canvas: TypstCanvas | undefined = $state();

  // Load zoom state from localStorage
  const savedLayout = browser ? loadLayoutState() : null;
  let currentZoomValue = $state(savedLayout?.zoomScale ?? 1);
  let currentZoomMode = $state<ZoomMode>(savedLayout?.zoomMode ?? 'custom');

  // Save zoom state to localStorage when it changes
  $effect(() => {
    if (browser) {
      saveLayoutState({
        zoomMode: currentZoomMode,
        zoomScale: currentZoomValue,
      });
    }
  });

  function zoomIn() { canvas?.zoomIn(); }
  function zoomOut() { canvas?.zoomOut(); }
  function setZoom(zoom: number) { canvas?.setZoom(zoom); }
  function fitToWidth() { canvas?.fitWidth(); }
  function fitToHeight() { canvas?.fitHeight(); }
  function fitToPage() { canvas?.fitPage(); }

  function handleZoomChange(zoom: number, mode: ZoomMode) {
    currentZoomValue = zoom;
    currentZoomMode = mode;
  }

  const zoomItems = [
    { label: "Fit to width", icon: MoveHorizontal, onclick: fitToWidth },
    { label: "Fit to height", icon: MoveVertical, onclick: fitToHeight },
    { label: "Fit to page", icon: File, onclick: fitToPage, separator: true },
    { label: "25%", onclick: () => setZoom(0.25) },
    { label: "50%", onclick: () => setZoom(0.5) },
    { label: "75%", onclick: () => setZoom(0.75) },
    { label: "100%", onclick: () => setZoom(1) },
    { label: "200%", onclick: () => setZoom(2) },
    { label: "300%", onclick: () => setZoom(3) },
  ];

  const exportItems = [
    { label: "Export as PDF", onclick: () => onExportPDF() },
    { label: "Export as PNG", onclick: () => onExportPNG() },
    { label: "Export as SVG", onclick: () => onExportSVG(), separator: true },
    { label: "Export sources as ZIP", onclick: () => onExportSourcesAsZip() },
  ];
</script>

<div class="preview-wrapper">
  <div class="preview-toolbar">
    <div class="zoom-controls">
      <Tooltip text="Zoom out" shortcut="Ctrl -" position="bottom">
        <ToolButton icon={Minus} onclick={zoomOut} position="first" />
      </Tooltip>
      <Tooltip text="Zoom options" position="bottom">
        <DropdownToolButton 
          icon={currentZoomMode === 'fit-width' ? MoveHorizontal : currentZoomMode === 'fit-height' ? MoveVertical : currentZoomMode === 'fit-page' ? File : `${Math.round(currentZoomValue * 100)}%`} 
          items={zoomItems} 
          position="middle"
          buttonWidth="45px"
          buttonBackground="var(--bg-top-bar)"
          allowIconOverflow={false}
          stick="left"
        />
      </Tooltip>
      <Tooltip text="Zoom in" shortcut="Ctrl +" position="bottom">
        <ToolButton icon={Plus} onclick={zoomIn} position="last" />
      </Tooltip>
    </div>
    <div class="split-view-control">
      <Tooltip text="Back to split view" position="bottom">
        <ToolButton icon={Columns2} onclick={onCloseSeparatePreview} position="standalone" />
      </Tooltip>
    </div>
    <div class="download-controls">
      <Tooltip text="Share" position="bottom">
        <ToolButton icon={Share2} onclick={onOpenShare} position="first"/>
      </Tooltip>
      <Tooltip text="Export PDF" position="bottom">
        <ToolButton icon={Download} onclick={() => onExportPDF()} position="middle"/>
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
  <div class="preview-canvas-wrapper">
    {#if core}
      <TypstCanvas
        bind:this={canvas}
        {core}
        {negative}
        initialZoomMode={currentZoomMode}
        initialZoom={currentZoomValue}
        onZoomChange={handleZoomChange}
      />
    {:else}
      <div class="preview-loading-overlay"><p>Loading preview...</p></div>
    {/if}
    <svg class="corner left" viewBox="0 0 1 1" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0 0 V 1 A 1 1 0 0 1 1 0 Z"/>
    </svg>
    <svg class="corner right" viewBox="0 0 1 1" xmlns="http://www.w3.org/2000/svg">
      <path d="M 1 0 V 1 A 1 1 0 0 0 0 0 Z"/>
    </svg>
  </div>
</div>

<style>
  .preview-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    padding: var(--space-2);
  }

  .preview-toolbar {
    height: 40px;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: var(--space-2);
    overflow: visible;
    background: var(--bg-top-bar);
  }

  .zoom-controls {
    display: flex;
    overflow: visible;
  }

  .split-view-control {
    display: flex;
  }

  .download-controls {
    margin-left: auto;
    display: flex;
  }

  .preview-canvas-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .corner {
    position: absolute;
    top: 0;
    width: var(--radius-lg);
    height: var(--radius-lg);
    fill: var(--bg-primary);
    pointer-events: none;
    z-index: 2;
  }

  .left {
    left: 0;
  }

  .right {
    right: 0;
  }

  .preview-loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-preview);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-lg);
    color: var(--text-muted);
    border-top-left-radius: var(--radius-lg);
    border-top-right-radius: var(--radius-lg);
  }
</style>
