<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ToolButton, DropdownToolButton, Tooltip } from "$lib/components/ui";
  import Plus from "@lucide/svelte/icons/plus";
  import Minus from "@lucide/svelte/icons/minus";
  import MoveHorizontal from "@lucide/svelte/icons/move-horizontal";
  import MoveVertical from "@lucide/svelte/icons/move-vertical";
  import File from "@lucide/svelte/icons/file";
  import PictureInPicture from "@lucide/svelte/icons/picture-in-picture";
  import Share2 from "@lucide/svelte/icons/share-2";
  import Download from "@lucide/svelte/icons/download";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import { browser } from '$app/environment';
  import type { FileWithContent as ProjectFile, Asset, Diagnostic } from '$lib/types';
  import { assetsApi } from "../../services/api";
  import { theme as themeStore } from '$lib/stores/theme';
  import { saveLayoutState, loadLayoutState } from '$lib/utils/layoutStorage';
  import JSZip from 'jszip';
  import TypstCanvas from './TypstCanvas.svelte';
  import ExportOptionsModal from './ExportOptionsModal.svelte';
  import { createPreviewController, type PreviewController } from '$lib/typst/previewController';
  import type { Core } from '@mudomi/onykia-engine';

  type ZoomMode = 'fit-width' | 'fit-height' | 'fit-page' | 'custom';

  interface Props {
    files?: ProjectFile[];
    assets?: Asset[];
    compileEnabled?: boolean;
    mainFilePath?: string;
    projectId?: string;
    onDiagnostics?: (diagnostics: Diagnostic[]) => void;
    projectName?: string;
    negativePreview?: boolean;
    showToolbar?: boolean;
    // Bound: exposes the booted engine so the popout window can share it.
    sharedCore?: Core | null;
    openSeparatePreview?: () => void;
    exportAsPDF?: () => void;
    exportAsPNG?: () => void;
    exportAsSVG?: () => void;
    exportSourcesAsZip?: () => void;
    // Bound: lets the parent tell the engine which file the editor owns.
    setActiveEditorFile?: (path: string | null) => void;
    onOpenShare?: () => void;
  }

  let {
    files = [],
    assets = [],
    compileEnabled = true,
    mainFilePath = '/main.typ',
    projectId = '',
    onDiagnostics,
    projectName,
    negativePreview = false,
    showToolbar = true,
    sharedCore = $bindable(null),
    openSeparatePreview = () => {},
    exportAsPDF = $bindable(() => {}),
    exportAsPNG = $bindable(() => {}),
    exportAsSVG = $bindable(() => {}),
    exportSourcesAsZip = $bindable(() => {}),
    setActiveEditorFile = $bindable((_path: string | null) => {}),
    onOpenShare = () => {},
  }: Props = $props();

  let canvas: TypstCanvas | undefined = $state();
  let controller: PreviewController | null = null;
  let core = $state<Core | null>(null);
  let status = $state('Initializing...');
  let isReady = $state(false);
  let pageCount = $state(0);

  // SVG/PNG go through the modal (per-page); PDF doesn't.
  let exportModalOpen = $state(false);
  let exportModalFormat = $state<'svg' | 'png'>('png');

  // Load zoom state from localStorage
  const savedLayout = browser ? loadLayoutState() : null;
  let currentZoomValue = $state(savedLayout?.zoomScale ?? 1);
  let currentZoomMode = $state<ZoomMode>(savedLayout?.zoomMode ?? 'custom');
  let currentTheme = $state<'light' | 'dark'>($themeStore);

  // Subscribe to theme changes
  $effect(() => {
    currentTheme = $themeStore;
  });

  // Save zoom state to localStorage when it changes
  $effect(() => {
    if (browser) {
      saveLayoutState({
        zoomMode: currentZoomMode,
        zoomScale: currentZoomValue,
      });
    }
  });

  // Negative invert only applies in dark theme.
  let shouldApplyNegativeFilter = $derived(negativePreview && currentTheme === 'dark');

  // --- Toolbar ---

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

  // --- Exports ---

  function triggerDownload(data: Uint8Array, mime: string, filename: string) {
    // Copy off SharedArrayBuffer; Blob rejects it.
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(data);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function runExport(
    opts:
      | { format: 'pdf' }
      | { format: 'svg'; index: number }
      | { format: 'png'; index: number; ppi?: number }
  ) {
    if (!controller) return;
    try {
      status = `Exporting ${opts.format.toUpperCase()}...`;
      const { data, mime } = await controller.exportDocument(opts);
      // Per-page exports tag the filename so successive exports don't clobber.
      const suffix = 'index' in opts ? `-p${opts.index + 1}` : '';
      triggerDownload(data, mime, `${projectName || 'document'}${suffix}.${opts.format}`);
      status = 'Ready';
    } catch (e: any) {
      console.error(`Export ${opts.format} failed:`, e);
      status = `Export error: ${e?.message ?? e}`;
      alert(`Failed to export as ${opts.format.toUpperCase()}`);
    }
  }

  function openExportModal(format: 'svg' | 'png') {
    if (pageCount === 0) {
      alert('No pages to export - wait for the first compile to finish.');
      return;
    }
    exportModalFormat = format;
    exportModalOpen = true;
  }

  exportAsPDF = () => void runExport({ format: 'pdf' });
  exportAsPNG = () => openExportModal('png');
  exportAsSVG = () => openExportModal('svg');

  function handleExportModalSubmit(opts: { index: number; ppi?: number }) {
    exportModalOpen = false;
    if (exportModalFormat === 'png') {
      void runExport({ format: 'png', index: opts.index, ppi: opts.ppi });
    } else {
      void runExport({ format: 'svg', index: opts.index });
    }
  }

  exportSourcesAsZip = async () => {
    try {
      const zip = new JSZip();
      for (const file of files) {
        if (!file.is_folder) {
          const path = file.path.startsWith('/') ? file.path.slice(1) : file.path;
          zip.file(path, file.content);
        }
      }
      for (const asset of assets) {
        try {
          const { url } = await assetsApi.getUrl(asset.project_id, asset.id);
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const path = asset.path.startsWith('/') ? asset.path.slice(1) : asset.path;
          zip.file(path, arrayBuffer);
        } catch (error) {
          console.error('Failed to add asset to ZIP:', asset.path, error);
        }
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectName || 'project'}-sources.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export sources as ZIP:', error);
      alert('Failed to export sources as ZIP');
    }
  };

  const exportItems = [
    { label: "Export as PDF", onclick: () => exportAsPDF() },
    { label: "Export as PNG", onclick: () => exportAsPNG() },
    { label: "Export as SVG", onclick: () => exportAsSVG(), separator: true },
    { label: "Export sources as ZIP", onclick: () => exportSourcesAsZip() },
  ];

  let offPages: (() => void) | null = null;

  // --- Engine boot + compile ---

  onMount(async () => {
    if (!browser) return;
    controller = createPreviewController({
      projectId,
      onDiagnostics: (diags) => onDiagnostics?.(diags),
    });
    setActiveEditorFile = (path: string | null) => controller?.setActiveEditorFile(path);
    try {
      status = 'Loading Typst engine...';
      core = await controller.ready();
      sharedCore = core;
      offPages = core.onPages(({ pages }) => {
        pageCount = pages.length;
      });
      isReady = true;
      status = 'Ready';
      if (compileEnabled) void controller.sync(files, assets, mainFilePath);
    } catch (e: any) {
      console.error('Typst engine failed to start:', e);
      status = `Engine error: ${e?.message ?? e}`;
    }
  });

  $effect(() => {
    void files;
    void assets;
    void mainFilePath;
    void compileEnabled;

    if (isReady && compileEnabled && controller) {
      void controller.sync(files, assets, mainFilePath);
    }
  });

  onDestroy(() => {
    offPages?.();
    offPages = null;
    controller?.destroy();
    controller = null;
  });

</script>

<div class="preview-wrapper preview-pane">
  {#if showToolbar}
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
    <div class="separate-preview-control">
      <Tooltip text="Show preview in popup" position="bottom">
        <ToolButton icon={PictureInPicture} onclick={() => openSeparatePreview()} position="standalone" />
      </Tooltip>
    </div>
    <div class="download-controls">
      <Tooltip text="Share" position="bottom">
        <ToolButton icon={Share2} onclick={onOpenShare} position="first"/>
      </Tooltip>
      <Tooltip text="Export PDF" position="bottom">
        <ToolButton icon={Download} onclick={() => exportAsPDF()} position="middle"/>
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
  <div class="preview-canvas-wrapper">
    {#if core}
      <TypstCanvas
        bind:this={canvas}
        {core}
        negative={shouldApplyNegativeFilter}
        initialZoomMode={currentZoomMode}
        initialZoom={currentZoomValue}
        onZoomChange={handleZoomChange}
      />
    {:else}
      <div class="preview-loading-overlay">
        <p>{status}</p>
      </div>
    {/if}
    <svg class="corner left" viewBox="0 0 1 1" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0 0 V 1 A 1 1 0 0 1 1 0 Z"/>
    </svg>
    <svg class="corner right" viewBox="0 0 1 1" xmlns="http://www.w3.org/2000/svg">
      <path d="M 1 0 V 1 A 1 1 0 0 0 0 0 Z"/>
    </svg>
  </div>
</div>

<ExportOptionsModal
  bind:open={exportModalOpen}
  format={exportModalFormat}
  {pageCount}
  onClose={() => (exportModalOpen = false)}
  onSubmit={handleExportModalSubmit}
/>

<style>
  .preview-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .preview-toolbar {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 0 var(--space-2) 0;
    overflow: visible;
    background: var(--bg-top-bar);
  }

  .zoom-controls {
    display: flex;
    overflow: visible;
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
    border-top-left-radius: var(--radius-lg);
    border-top-right-radius: var(--radius-lg);
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
