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
  import { assetsApi, projectsApi } from "../../services/api";
  import { getCachedAsset, cacheAsset } from '$lib/utils/assetCache';
  import { theme as themeStore } from '$lib/stores/theme';
  import { saveLayoutState, loadLayoutState } from '$lib/utils/layoutStorage';
  import JSZip from 'jszip';

  interface Props {
    files?: ProjectFile[];
    assets?: Asset[];
    compileEnabled?: boolean;
    mainFilePath?: string;
    onDiagnostics?: (diagnostics: Diagnostic[]) => void;
    projectId?: string;
    thumbnailUploadEnabled?: boolean;
    projectName?: string;
    negativePreview?: boolean;
    showToolbar?: boolean;
    renderSession?: any;
    separateWindow?: Window | null;
    openSeparatePreview?: () => void;
    exportAsPDF?: () => void;
    exportAsPNG?: () => void;
    exportAsSVG?: () => void;
    exportSourcesAsZip?: () => void;
    onOpenShare?: () => void;
  }

  let {
    files = [],
    assets = [],
    compileEnabled = true,
    mainFilePath = '/main.typ',
    onDiagnostics,
    projectId,
    thumbnailUploadEnabled = true,
    projectName,
    negativePreview = false,
    showToolbar = true,
    renderSession = $bindable(null),
    separateWindow = null,
    openSeparatePreview = () => {},
    exportAsPDF = $bindable(() => {}),
    exportAsPNG = $bindable(() => {}),
    exportAsSVG = $bindable(() => {}),
    exportSourcesAsZip = $bindable(() => {}),
    onOpenShare = () => {},
  }: Props = $props();

  // iframe reference for communication
  let previewIframe: HTMLIFrameElement | undefined;
  let iframeMockReady = false;
  let isPreviewZoomInitialized = $state(false);

  // Load zoom state from localStorage
  const savedLayout = browser ? loadLayoutState() : null;
  let currentZoomValue = $state(savedLayout?.zoomScale ?? 1);
  let currentZoomMode = $state<'fit-width' | 'fit-height' | 'fit-page' | 'custom'>(savedLayout?.zoomMode ?? 'custom');
  let currentTheme = $state<'light' | 'dark'>($themeStore);
  let inhibNextZoomChange = false;
  
  // Subscribe to theme changes
  $effect(() => {
    currentTheme = $themeStore;
  });
  
  // Save zoom state to localStorage when it changes
  $effect(() => {
    if (browser && currentZoomMode && currentZoomValue) {
      saveLayoutState({
        zoomMode: currentZoomMode,
        zoomScale: currentZoomValue,
      });
    }
  });
  
  // Compute whether to apply negative filter (only in dark theme)
  let shouldApplyNegativeFilter = $derived(negativePreview && currentTheme === 'dark');

    // --- Toolbar Handlers (send commands to iframe) ---

    function zoomIn() {
      sendCommandToIframe('zoom-in');
    }

    function zoomOut() {
      sendCommandToIframe('zoom-out');
    }

    function setZoom(zoom: number) {
      currentZoomValue = zoom;
      currentZoomMode = 'custom';
      sendCommandToIframe('set-zoom', { zoom, mode: 'custom' });
    }

    function fitToWidth() {
      currentZoomMode = 'fit-width';
      inhibNextZoomChange = true;
      sendCommandToIframe('fit-width');
    }

    function fitToHeight() {
      currentZoomMode = 'fit-height';
      inhibNextZoomChange = true;
      sendCommandToIframe('fit-height');
    }

    function fitToPage() {
      currentZoomMode = 'fit-page';
      inhibNextZoomChange = true;
      sendCommandToIframe('fit-page');
    }

    function reapplyCurrentZoomMode() {
      switch (currentZoomMode) {
        case 'fit-width':
          fitToWidth();
          break;
        case 'fit-height':
          fitToHeight();
          break;
        case 'fit-page':
          fitToPage();
          break;
        case 'custom':
          setZoom(currentZoomValue);
          break;
      }
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
      { label: "25%", onclick: () => setZoom(0.25) },
      { label: "50%", onclick: () => setZoom(0.5) },
      { label: "75%", onclick: () => setZoom(0.75) },
      { label: "100%", onclick: () => setZoom(1) },
      { label: "200%", onclick: () => setZoom(2) },
      { label: "300%", onclick: () => setZoom(3) },
    ];

    exportAsPDF = () => {
      worker?.postMessage({ type: 'exportPDF', payload: { mainFilePath } });
    }

    function exportNotImplemented(format: string) {
      alert(`Export as ${format} not implemented yet`);
    }

    exportAsPNG = () => {
      exportNotImplemented("PNG");
    }

    exportAsSVG = () => {
      exportNotImplemented("SVG");
    }

    exportSourcesAsZip = async () => {
      try {
        const zip = new JSZip();

        // Add all project files
        for (const file of files) {
          if (!file.is_folder) {
            const path = file.path.startsWith('/') ? file.path.slice(1) : file.path;
            zip.file(path, file.content);
          }
        }

        // Add all assets
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

        // Generate ZIP and download
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
    }

    const exportItems = [
      { label: "Export as PDF", onclick: exportAsPDF },
      { label: "Export as PNG", onclick: exportAsPNG },
      { label: "Export as SVG", onclick: exportAsSVG, separator: true },
      { label: "Export sources as ZIP", onclick: exportSourcesAsZip },
    ];
  let status = $state('Initializing...');
  let worker: Worker | undefined;
  let initialized = false;
  let workerReady = false;
  let latestMainFilePath: string | null = null;
  const THUMBNAIL_WIDTH = 320;
  const THUMBNAIL_UPLOAD_DEBOUNCE_MS = 3000;
  const THUMBNAIL_MIN_UPLOAD_INTERVAL_MS = 120000;
  const THUMBNAIL_CAPTURE_RETRIES = 20;
  const THUMBNAIL_CAPTURE_RETRY_MS = 100;
  let thumbnailUploadTimeout: ReturnType<typeof setTimeout> | null = null;
  let thumbnailThrottleTimeout: ReturnType<typeof setTimeout> | null = null;
  let thumbnailUploadInFlight = false;
  let lastThumbnailUploadAt = 0;
  let lastUploadedThumbnailSignature: string | null = null;
  

  // Track loaded files/assets to detect changes
  const loadedFiles = new Map<string, { path: string; content: string }>();
  const loadedAssets = new Map<string, { path: string; storage_path: string }>();

  // Handle messages from iframe
  function handleIframeMessage(event: MessageEvent) {
    // Security: verify origin in production
    const { type, data, command, zoom, mode } = event.data || {};

    switch (type) {
      case 'typst-ws-mock-ready':
        // Iframe mock WebSocket is ready to receive connections - can be usefull ¯\_(ツ)_/¯
        break;

      case 'typst-ws-connect':
        // Iframe mock WebSocket is now connected - can be usefull too ¯\_(ツ)_/¯
        break;

      case 'typst-ws-send':
        handleIframeSend(data);
        break;

      case 'typst-ws-close':
        // Iframe mock WebSocket closed - can be usefull also ¯\_(ツ)_/¯
        break;

      case 'typst-zoom-changed':
        if (inhibNextZoomChange) {
          // Ignore this change - it was a backlash of our own command
          inhibNextZoomChange = false;
          return;
        }
        if (typeof zoom === 'number') {
          currentZoomValue = zoom;
          currentZoomMode = mode ?? 'custom';
        }
        break;

      case 'typst-request-current':
        // Iframe is requesting current state - trigger a recompile
        syncFilesAndAssets();
        break;

      case 'typst-zoom-initialized':
        isPreviewZoomInitialized = true;
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
          status = 'Ready';
        }
        // Iframe is requesting current state - trigger a recompile
        syncFilesAndAssets();
      }
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
    // Note: We copy the buffer to avoid transferring ownership which would detach the original
    previewIframe.contentWindow.postMessage({
      type: 'typst-ws-message',
      data: combined.buffer.slice(0)
    }, '*');
  }

  // Sync files and assets with the worker
  // Debounce syncFilesAndAssets to prevent rapid repeated calls
  let syncTimeout: any = null;
  async function _syncFilesAndAssets() {
    if (!worker || !workerReady) return;

    // Handle files
    const currentFilesMap = new Map(files.map(f => [f.id, f]));

    // Remove deleted/moved files
    for (const [fileId, cached] of loadedFiles) {
      const current = currentFilesMap.get(fileId);
      if (!current || current.path !== cached.path) {
        const pathToRemove = cached.path.startsWith('/') ? cached.path : `/${cached.path}`;
        worker.postMessage({ type: 'removeFile', payload: { path: pathToRemove } });
        loadedFiles.delete(fileId);
      }
    }

    // Add new/updated files
    for (const file of files) {
      if (file.is_folder) continue;

      const cached = loadedFiles.get(file.id);
      const path = file.path.startsWith('/') ? file.path : `/${file.path}`;

      if (!cached || cached.content !== file.content || cached.path !== file.path) {
        worker.postMessage({
          type: 'addFile',
          payload: { path, content: file.content }
        });
        loadedFiles.set(file.id, { path: file.path, content: file.content });
      }
    }

    // Handle assets
    const currentAssetsMap = new Map(assets.map(a => [a.id, a]));

    // Remove deleted/moved assets
    for (const [assetId, cached] of loadedAssets) {
      const current = currentAssetsMap.get(assetId);
      if (!current || current.path !== cached.path) {
        const pathToRemove = cached.path.startsWith('/') ? cached.path : `/${cached.path}`;
        worker.postMessage({ type: 'removeFile', payload: { path: pathToRemove } });
        loadedAssets.delete(assetId);
      }
    }

    // Add new/updated assets
    for (const asset of assets) {
      const cached = loadedAssets.get(asset.id);
      const path = asset.path.startsWith('/') ? asset.path : `/${asset.path}`;

      if (!cached || cached.storage_path !== asset.storage_path || cached.path !== asset.path) {
        try {
          let arrayBuffer: ArrayBuffer;

          // Try IndexedDB cache first
          const cachedBlob = await getCachedAsset(String(asset.project_id), asset.id, asset.storage_path);

          if (cachedBlob) {
            // Use cached data
            arrayBuffer = cachedBlob.blob;
          } else {
            // Fetch from API and cache
            const { url } = await assetsApi.getUrl(String(asset.project_id), asset.id);
            const response = await fetch(url);
            arrayBuffer = await response.arrayBuffer();

            // Store in IndexedDB cache (fire and forget)
            cacheAsset(String(asset.project_id), asset.id, asset.storage_path, asset.mime_type, arrayBuffer)
              .catch(err => console.warn('Failed to cache asset:', err));
          }

          const uint8Array = new Uint8Array(arrayBuffer);

          worker.postMessage({
            type: 'addAsset',
            payload: { path, data: uint8Array }
          }, [uint8Array.buffer]);

          loadedAssets.set(asset.id, { path: asset.path, storage_path: asset.storage_path });
        } catch (error) {
          console.error('Failed to load asset:', asset.path, error);
        }
      }
    }

    // Trigger compilation
    compile();
  }

  function syncFilesAndAssets() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      _syncFilesAndAssets();
    }, 30); // 30ms debounce
  }

  function compile() {
    if (!worker || !workerReady) return;
    const path = mainFilePath.startsWith('/') ? mainFilePath : `/${mainFilePath}`;
    worker.postMessage({
      type: 'compile',
      payload: { mainFilePath: path },
    });
  }

  function scheduleThumbnailUpload() {
    if (!projectId || !thumbnailUploadEnabled || !previewIframe) return;
    if (thumbnailUploadTimeout) clearTimeout(thumbnailUploadTimeout);

    thumbnailUploadTimeout = setTimeout(() => {
      thumbnailUploadTimeout = null;
      requestThumbnailUpload();
    }, THUMBNAIL_UPLOAD_DEBOUNCE_MS);
  }

  function requestThumbnailUpload() {
    if (!projectId || !thumbnailUploadEnabled || !previewIframe) return;

    const elapsed = Date.now() - lastThumbnailUploadAt;
    const wait = lastThumbnailUploadAt
      ? Math.max(0, THUMBNAIL_MIN_UPLOAD_INTERVAL_MS - elapsed)
      : 0;

    if (wait === 0) {
      if (thumbnailThrottleTimeout) {
        clearTimeout(thumbnailThrottleTimeout);
        thumbnailThrottleTimeout = null;
      }
      void uploadCurrentThumbnail();
      return;
    }

    if (thumbnailThrottleTimeout) clearTimeout(thumbnailThrottleTimeout);
    thumbnailThrottleTimeout = setTimeout(() => {
      thumbnailThrottleTimeout = null;
      void uploadCurrentThumbnail();
    }, wait);
  }

  async function uploadCurrentThumbnail() {
    if (!projectId || !thumbnailUploadEnabled || thumbnailUploadInFlight) return;

    thumbnailUploadInFlight = true;
    try {
      const thumbnail = await captureCurrentThumbnail();
      if (!thumbnail || thumbnail.signature === lastUploadedThumbnailSignature) {
        return;
      }

      await projectsApi.uploadThumbnail(projectId, thumbnail.blob);
      lastThumbnailUploadAt = Date.now();
      lastUploadedThumbnailSignature = thumbnail.signature;
    } catch (error) {
      console.warn('Failed to update project thumbnail:', error);
    } finally {
      thumbnailUploadInFlight = false;
    }
  }

  async function captureCurrentThumbnail(): Promise<{ blob: Blob; signature: string } | null> {
    const page = await waitForPreviewPage();
    if (!page) return null;

    const { svg, pageRect } = page;
    const pageWidth = Number(pageRect.getAttribute('data-page-width'));
    const pageHeight = Number(pageRect.getAttribute('data-page-height'));
    if (!Number.isFinite(pageWidth) || !Number.isFinite(pageHeight) || pageWidth <= 0 || pageHeight <= 0) {
      return null;
    }

    const { x, y } = parsePageTranslate(pageRect.getAttribute('transform') || '');
    const height = Math.round(THUMBNAIL_WIDTH * (pageHeight / pageWidth));
    const pageNumber = pageRect.getAttribute('data-page-number') || '0';
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('.typst-svg-cursor').forEach((cursor) => cursor.remove());
    clone.querySelectorAll('.typst-page').forEach((page) => {
      if (page.getAttribute('data-page-number') !== pageNumber) page.remove();
    });
    clone.querySelectorAll('rect.typst-page-inner').forEach((rect) => {
      if (rect.getAttribute('data-page-number') !== pageNumber) rect.remove();
    });
    clone.querySelectorAll('clipPath[id^="typst-page-clip-"]').forEach((clipPath) => {
      if (clipPath.id !== `typst-page-clip-${pageNumber}`) clipPath.remove();
    });
    clone.querySelectorAll('.typst-preview-svg-page-number').forEach((pageNumberLabel) => pageNumberLabel.remove());
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('viewBox', `${x} ${y} ${pageWidth} ${pageHeight}`);
    clone.setAttribute('width', `${THUMBNAIL_WIDTH}`);
    clone.setAttribute('height', `${height}`);
    clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const serializedSvg = new XMLSerializer().serializeToString(clone);
    const blob = await renderSvgToPng(serializedSvg, THUMBNAIL_WIDTH, height);
    if (!blob) return null;

    return {
      blob,
      signature: await getBlobSignature(blob),
    };
  }

  async function waitForPreviewPage(): Promise<{ svg: SVGSVGElement; pageRect: SVGRectElement } | null> {
    for (let attempt = 0; attempt < THUMBNAIL_CAPTURE_RETRIES; attempt++) {
      const doc = previewIframe?.contentDocument;
      const svg = doc?.querySelector('#typst-app svg') as SVGSVGElement | null;
      const pageRect = doc?.querySelector('rect.typst-page-inner') as SVGRectElement | null;

      if (svg && pageRect) {
        return { svg, pageRect };
      }

      await new Promise((resolve) => setTimeout(resolve, THUMBNAIL_CAPTURE_RETRY_MS));
    }

    return null;
  }

  function parsePageTranslate(transform: string): { x: number; y: number } {
    const match = transform.match(/translate\(([-+\d.eE]+)[,\s]+([-+\d.eE]+)\)/);
    return {
      x: match ? Number(match[1]) || 0 : 0,
      y: match ? Number(match[2]) || 0 : 0,
    };
  }

  async function renderSvgToPng(svg: string, width: number, height: number): Promise<Blob | null> {
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Failed to load rendered SVG thumbnail'));
        image.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) return null;

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      return await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function getBlobSignature(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    if (!globalThis.crypto?.subtle) return `${blob.size}:${buffer.byteLength}`;

    const hash = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash))
      .slice(0, 16)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  // Worker Setup
  onMount(() => {
    if (!browser) return;

    // Set up message listener for iframe communication
    window.addEventListener('message', handleIframeMessage);

    // Create worker (only runs in browser)
    worker = new Worker(
      new URL('/src/lib/preview/typst-worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = async (e) => {
      const { type, vectorData, compileTime, isFirstCompile, diagnostics } = e.data;

      switch (type) {
        case 'status':
          status = e.data.message;
          break;

        case 'initialized':
          workerReady = true;
          status = compileEnabled
            ? 'Compiler ready - waiting for iframe...'
            : 'Preparing files...';

          // Force a sync only when file hydration is ready.
          if (compileEnabled) {
            syncFilesAndAssets();
          }
          reapplyCurrentZoomMode();
          break;

        case 'compiled':
          if (!initialized) {
            status = 'Waiting for iframe...';
            return;
          }

          // Handle diagnostics
          if (diagnostics && onDiagnostics) {
            console.log('Received diagnostics from worker:', diagnostics);
            onDiagnostics(diagnostics);
          }

          if (!vectorData) {
            status = `Ready (${compileTime}ms) - no output`;
            return;
          }

          try {
            status = 'Rendering...';

            if (separateWindow) {
              sendVectorDataToWindow(separateWindow, vectorData, isFirstCompile);
            } else {
              // Send vector data to iframe
              sendVectorDataToIframe(vectorData, isFirstCompile);
              scheduleThumbnailUpload();
            }

            status = `Ready (${compileTime}ms)`;
          } catch (error: any) {
            status = `Render error: ${error.message}`;
            console.error('Render error:', error);
          }
          break;

        case 'error':
          if (diagnostics && onDiagnostics) {
            console.log('Received diagnostics from worker:', diagnostics);
            onDiagnostics(diagnostics);
          }
          status = `Compile error: ${e.data.error}`;
          console.error('Compilation error:', e.data);
          break;

        case 'pdf':
          const pdfBlob = new Blob([e.data.pdfData], { type: 'application/pdf' });
          const pdfUrl = URL.createObjectURL(pdfBlob);
          const pdfLink = document.createElement('a');
          pdfLink.href = pdfUrl;
          // get project name
          console.log("projectName:", projectName);
          pdfLink.download = `${projectName || 'document'}.pdf`;
          document.body.appendChild(pdfLink);
          pdfLink.click();
          document.body.removeChild(pdfLink);
          URL.revokeObjectURL(pdfUrl);
          break;

        case 'reset':
          console.log('Worker: Resetting document as requested');
          // if (typstDoc) typstDoc.reset();
          status = 'Reset complete';
          break;
      }
    };

    worker.onerror = (e) => {
      const errorMsg = e.message || (e.error as any)?.message || 'Unknown error';
      status = `Worker error: ${errorMsg}`;
      console.error('Worker error:', e);
    };
  });

  // Watch for changes in files, assets, or mainFilePath
  $effect(() => {
    // Track reactive dependencies by reading them
    void files;
    void assets;
    void mainFilePath;
    void compileEnabled;

    if (latestMainFilePath !== mainFilePath) {
      latestMainFilePath = mainFilePath;
    
      if (worker && workerReady) {
        
        worker.postMessage({ type: 'reset' });
        
      }
    }

    if (workerReady && initialized && compileEnabled) {
      syncFilesAndAssets();
    } else if (workerReady && initialized && !compileEnabled) {
      status = 'Preparing files...';
    }
  });

  onDestroy(() => {
    // Clean up message listener
    if (browser) {
      window.removeEventListener('message', handleIframeMessage);
    }
    if (worker) {
      worker.terminate();
    }
    if (thumbnailUploadTimeout) {
      clearTimeout(thumbnailUploadTimeout);
    }
    if (thumbnailThrottleTimeout) {
      clearTimeout(thumbnailThrottleTimeout);
    }
  });

  function sendVectorDataToWindow(targetWindow: Window, vectorData: ArrayBuffer, isFirstCompile: boolean) {
    targetWindow.postMessage(
      {
        type: 'typst-vector-data',
        data: vectorData,
        isFirstCompile: isFirstCompile,
      },
      '*'
    );
  }

  function forceRecompile() {
    if (worker && workerReady) {
      worker.postMessage({ type: 'reset' });
    }
  }

  // Watch for changes in separateWindow to recompile and send data
  $effect(() => {
    void separateWindow;
    void compileEnabled;

    if (workerReady && initialized && compileEnabled) {
      forceRecompile();
      syncFilesAndAssets();
    }
  });

  let pixelPerPt = $state(3);
  function setPixelPerPt(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value) && value > 0) {
      pixelPerPt = value;
      sendCommandToIframe('typst-set-pixelperpt', { pixelPerPt });
    }
  }

  // Handle separate preview button click
  function handleSeparatePreview() {
    openSeparatePreview();
  }
</script>

<div class="preview-wrapper">
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
        <ToolButton icon={PictureInPicture} onclick={handleSeparatePreview} position="standalone" />
      </Tooltip>
    </div>
    <div class="download-controls">
      <Tooltip text="Share" position="bottom">
        <ToolButton icon={Share2} onclick={onOpenShare} position="first"/>
      </Tooltip>
      <Tooltip text="Export PDF" position="bottom">
        <ToolButton icon={Download} onclick={exportAsPDF} position="middle"/>
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
  <div class="preview-iframe-wrapper">
    <iframe
      bind:this={previewIframe}
      id="preview-iframe"
      class="preview-iframe"
      title="Typst Preview"
      src="/typst-preview">
    </iframe>
    {#if !isPreviewZoomInitialized}
      <div class="preview-loading-overlay">
        <p>Loading preview...</p>
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

  .preview-iframe-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .preview-iframe {
    height: 100%;
    width: 100%;
    border: none;
  }

  .corner {
    position: absolute;
    top: 0;
    width: var(--radius-lg);
    height: var(--radius-lg);
    fill: var(--bg-primary);
    pointer-events: none;
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

  /* Typst text selection and positioning */
  :global(.tsel span),
  :global(.tsel) {
    left: 0;
    position: fixed;
    text-align: justify;
    white-space: nowrap;
    width: 100%;
    height: 100%;
    text-align-last: justify;
    color: transparent;
  }

  :global(.tsel span::-moz-selection),
  :global(.tsel::-moz-selection) {
    color: transparent;
    background: #7db9dea0;
  }

  :global(.tsel span::selection),
  :global(.tsel::selection) {
    color: transparent;
    background: #7db9dea0;
  }

  :global(.negative-filter .typst-doc) {
    filter: invert(1);
  }

  :global(.pseudo-link) {
  fill: transparent;
  cursor: pointer;
  pointer-events: all;
}
</style>
