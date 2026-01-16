<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { ToolButton, DropdownToolButton, Tooltip } from "$lib/components/ui";
  import Plus from "@lucide/svelte/icons/plus";
  import Minus from "@lucide/svelte/icons/minus";
  import MoveHorizontal from "@lucide/svelte/icons/move-horizontal";
  import MoveVertical from "@lucide/svelte/icons/move-vertical";
  import File from "@lucide/svelte/icons/file";
  import Columns2 from "@lucide/svelte/icons/columns-2";
  import Download from "@lucide/svelte/icons/download";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import { saveLayoutState, loadLayoutState } from '$lib/utils/layoutStorage';
  import { browser } from '$app/environment';

  interface Props {
    separateWindow: Window;
    projectName?: string;
    onCloseSeparatePreview?: () => void;
    onExportPDF?: () => void;
    onExportPNG?: () => void;
    onExportSVG?: () => void;
    onExportSourcesAsZip?: () => void;
  }

  let {
    separateWindow,
    projectName = 'document',
    onCloseSeparatePreview = () => {},
    onExportPDF = () => {},
    onExportPNG = () => { alert("Export as PNG not implemented yet"); },
    onExportSVG = () => { alert("Export as SVG not implemented yet"); },
    onExportSourcesAsZip = () => {},
  }: Props = $props();

  // iframe reference for communication
  let previewIframe: HTMLIFrameElement | undefined;
  let iframeMockReady = false;
  let initialized = false;

  // Queue for messages that arrive before iframe is ready
  let messageQueue: Array<{ data: any; isFirstCompile: boolean }> = [];

  // Load zoom state from localStorage
  const savedLayout = browser ? loadLayoutState() : null;
  let currentZoomScale = $state(savedLayout?.zoomScale ?? 1);
  let currentZoomMode = $state<'fit-width' | 'fit-height' | 'fit-page' | 'custom'>(savedLayout?.zoomMode ?? 'custom');

  // Save zoom state to localStorage when it changes
  $effect(() => {
    if (browser && currentZoomMode && currentZoomScale) {
      saveLayoutState({
        zoomMode: currentZoomMode,
        zoomScale: currentZoomScale,
      });
    }
  });

  // --- Zoom Logic (via iframe commands) ---
  function zoomIn() {
    sendCommandToIframe('zoom-in');
  }

  function zoomOut() {
    sendCommandToIframe('zoom-out');
  }

  function setZoom(scale: number, mode: 'fit-width' | 'fit-height' | 'fit-page' | 'custom' = 'custom') {
    currentZoomScale = scale;
    currentZoomMode = mode;
    sendCommandToIframe('set-zoom', { scale, mode });
  }

  function fitToWidth() {
    currentZoomMode = 'fit-width';
    sendCommandToIframe('fit-width');
  }

  function fitToHeight() {
    currentZoomMode = 'fit-height';
    sendCommandToIframe('fit-height');
  }

  function fitToPage() {
    currentZoomMode = 'fit-page';
    sendCommandToIframe('fit-page');
  }

  // Send a command to the iframe
  function sendCommandToIframe(command: string, payload?: any) {
    if (previewIframe?.contentWindow) {
      previewIframe.contentWindow.postMessage({
        type: 'typst-command',
        command,
        payload
      }, '*');
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

  const exportItems = [
    { label: "Export as PDF", onclick: () => onExportPDF() },
    { label: "Export as PNG", onclick: () => onExportPNG() },
    { label: "Export as SVG", onclick: () => onExportSVG(), separator: true },
    { label: "Export sources as ZIP", onclick: () => onExportSourcesAsZip() },
  ];

  // Handle messages from iframe
  function handleIframeMessage(event: MessageEvent) {
    const { type, data, command, zoom, mode } = event.data || {};

    switch (type) {
      case 'typst-ws-send':
        handleIframeSend(data);
        break;

      case 'typst-zoom-changed':
        if (typeof zoom === 'number') {
          currentZoomScale = zoom;
          currentZoomMode = mode ?? 'custom';
        }
        break;
    }
  }

  // Handle messages the iframe sends via the mock WebSocket
  function handleIframeSend(data: string | ArrayBuffer) {
    if (typeof data === 'string') {
      if (data === 'current') {
        if (!iframeMockReady) {
          // First time receiving 'current' - iframe mock is ready
          iframeMockReady = true;
          initialized = true;
          processQueuedMessages();
        }
      }
    }
  }

  // Handle messages from the main window (vector data from compiler)
  function handleMainWindowMessage(event: MessageEvent) {
    if (event.data.type === "typst-vector-data") {
      const { data, isFirstCompile } = event.data;


      if (initialized && iframeMockReady) {
        // Forward to iframe immediately
        sendVectorDataToIframe(data, isFirstCompile);
      } else {
        // Queue message for later processing
        messageQueue.push({ data, isFirstCompile });
      }
    }
  }

  // Process queued messages after iframe is ready
  function processQueuedMessages() {
    for (const msg of messageQueue) {
      sendVectorDataToIframe(msg.data, msg.isFirstCompile);
    }
    messageQueue = [];

    // Request current state from main window after iframe is ready
    // This triggers a recompile in the main window
    if (window.opener) {
      window.opener.postMessage({ type: 'typst-request-current' }, '*');
    }
  }

  // Send vector data to the iframe via postMessage
  function sendVectorDataToIframe(vectorData: ArrayBuffer, isFirstCompile: boolean) {
    if (!previewIframe?.contentWindow || !iframeMockReady) {
      return;
    }

    // Format message as the typst preview expects: "messageType,binaryData"
    const messageType = isFirstCompile ? 'new' : 'diff-v1';
    const encoder = new TextEncoder();
    const typeBytes = encoder.encode(messageType + ',');

    // Combine type and data
    const combined = new Uint8Array(typeBytes.length + vectorData.byteLength);
    combined.set(typeBytes, 0);
    combined.set(new Uint8Array(vectorData), typeBytes.length);

    // Send via postMessage to iframe
    previewIframe.contentWindow.postMessage({
      type: 'typst-ws-message',
      data: combined.buffer.slice(0)
    }, '*');
  }

  onMount(() => {
    if (!browser) return;

    // Listen for messages from the iframe (zoom changes, mock ready)
    separateWindow.addEventListener('message', handleIframeMessage);

    // Listen for messages from the main window (vector data)
    separateWindow.addEventListener('message', handleMainWindowMessage);
  });

  onDestroy(() => {
    if (browser) {
      separateWindow.removeEventListener('message', handleIframeMessage);
      separateWindow.removeEventListener('message', handleMainWindowMessage);
    }
  });
</script>

<div class="preview-wrapper">
  <div class="preview-toolbar">
    <div class="zoom-controls">
      <Tooltip text="Zoom out" shortcut="Ctrl -" position="bottom">
        <ToolButton icon={Minus} onclick={zoomOut} position="first" />
      </Tooltip>
      <Tooltip text="Zoom options" position="bottom">
        <DropdownToolButton 
          icon={currentZoomMode === 'fit-width' ? MoveHorizontal : currentZoomMode === 'fit-height' ? MoveVertical : currentZoomMode === 'fit-page' ? File : `${Math.round(currentZoomScale * 100)}%`} 
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
      <Tooltip text="Export PDF" position="bottom">
        <ToolButton icon={Download} onclick={onExportPDF} position="first"/>
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
  <iframe
    bind:this={previewIframe}
    id="preview-iframe"
    class="preview-iframe"
    title="Typst Preview"
    src="/api/typst-preview">
  </iframe>
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

  .preview-iframe {
    flex: 1;
    width: 100%;
    border: none;
    border-top-left-radius: var(--radius-md);
    border-top-right-radius: var(--radius-md);
  }
</style>
