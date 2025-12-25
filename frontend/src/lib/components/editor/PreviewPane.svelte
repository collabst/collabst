<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ToolButton, DropdownToolButton, Tooltip } from "$lib/components/ui";
  import Plus from "@lucide/svelte/icons/plus";
  import Minus from "@lucide/svelte/icons/minus";
  import MoveHorizontal from "@lucide/svelte/icons/move-horizontal";
  import MoveVertical from "@lucide/svelte/icons/move-vertical";
  import File from "@lucide/svelte/icons/file";
  import Download from "@lucide/svelte/icons/download";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import { browser } from '$app/environment';
  import type { File as ProjectFile, Asset, Diagnostic } from '$lib/types';
  import { assetsApi } from "../../services/api";
  import { getCachedAsset, cacheAsset } from '$lib/utils/assetCache';
  import { theme as themeStore } from '$lib/stores/theme';
  import { saveLayoutState, loadLayoutState } from '$lib/utils/layoutStorage';
  import JSZip from 'jszip';
  // Will be set dynamically in browser only
  let TypstSvgDocument: any = null;

  interface Props {
    files?: ProjectFile[];
    assets?: Asset[];
    mainFilePath?: string;
    onDiagnostics?: (diagnostics: Diagnostic[]) => void;
    projectName?: string;
    negativePreview?: boolean;
    showToolbar?: boolean;
  }

  let {
    files = [],
    assets = [],
    mainFilePath = '/main.typ',
    onDiagnostics,
    projectName,
    negativePreview = false,
    showToolbar = true
  }: Props = $props();

  let previewContainer: HTMLDivElement | undefined;
  let docContainer: HTMLDivElement | undefined;
  
  // Load zoom state from localStorage
  const savedLayout = browser ? loadLayoutState() : null;
  let currentZoomScale = $state(savedLayout?.zoomScale ?? 1);
  let currentZoomMode = $state<'fit-width' | 'fit-height' | 'fit-page' | 'custom'>(savedLayout?.zoomMode ?? 'custom');
  let currentTheme = $state<'light' | 'dark'>($themeStore);
  
  // Subscribe to theme changes
  $effect(() => {
    currentTheme = $themeStore;
  });
  
  // Save zoom state to localStorage when it changes
  $effect(() => {
    if (browser && currentZoomMode && currentZoomScale) {
      saveLayoutState({
        zoomMode: currentZoomMode,
        zoomScale: currentZoomScale,
      });
    }
  });
  
  // Compute whether to apply negative filter (only in dark theme)
  let shouldApplyNegativeFilter = $derived(negativePreview && currentTheme === 'dark');

    // --- Toolbar Handlers ---

    // --- Unified Zoom Logic: Use TypstDocument's rescale logic ---
    function updateZoomStateFromTypst() {
      if (typstDoc && typstDoc.impl) {
        currentZoomScale = typstDoc.impl.currentScaleRatio;
        currentZoomMode = 'custom'; // Could be improved if you track fit modes
      }
    }

    function zoomIn() {
      if (typstDoc && typstDoc.impl) {
        // Simulate Ctrl+= (enlarge)
        typstDoc.impl.__doRescaleFromToolbar?.(-1);
        updateZoomStateFromTypst();
      }
    }

    function zoomOut() {
      if (typstDoc && typstDoc.impl) {
        // Simulate Ctrl+- (reduce)
        typstDoc.impl.__doRescaleFromToolbar?.(1);
        updateZoomStateFromTypst();
      }
    }

    function setZoom(scale: number, mode: 'fit-width' | 'fit-height' | 'fit-page' | 'custom' = 'custom') {
      if (typstDoc && typstDoc.impl) {
        typstDoc.impl.currentScaleRatio = scale;
        typstDoc.impl.r.rescale();
        // typstDoc.impl.addViewportChange();
        currentZoomScale = scale;
        currentZoomMode = mode;
      }
    }

    function fitToWidth() {
      if (previewContainer && docContainer && typstDoc && typstDoc.impl) {
        const containerWidth = previewContainer.clientWidth;
        const docWidth = docContainer.scrollWidth;
        const scale = (containerWidth - 40) / docWidth;
        setZoom(scale, 'fit-width');
      }
    }

    function fitToHeight() {
      if (previewContainer && docContainer && typstDoc && typstDoc.impl) {
        const containerHeight = previewContainer.clientHeight;
        const docHeight = docContainer.scrollHeight;
        const scale = (containerHeight - 40) / docHeight;
        setZoom(scale, 'fit-height');
      }
    }

    function fitToPage() {
      if (previewContainer && docContainer && typstDoc && typstDoc.impl) {
        const containerWidth = previewContainer.clientWidth;
        const containerHeight = previewContainer.clientHeight;
        const docWidth = docContainer.scrollWidth;
        const docHeight = docContainer.scrollHeight;
        const scaleWidth = (containerWidth - 40) / docWidth;
        const scaleHeight = (containerHeight - 40) / docHeight;
        const scale = Math.min(scaleWidth, scaleHeight);
        setZoom(scale, 'fit-page');
      }
    }
  // Patch TypstDocumentContext to expose doRescale for toolbar
  function patchTypstDocForToolbarZoom(typstDoc: any) {
    if (!typstDoc || !typstDoc.impl) return;
    if (typeof typstDoc.impl.__doRescaleFromToolbar === 'function') return;
    // Expose a method to simulate wheel zoom
    typstDoc.impl.__doRescaleFromToolbar = function(direction: number) {
      // direction: -1 for zoom in, 1 for zoom out
      const factors = [
        0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.3, 1.5, 1.7, 1.9, 2.1, 2.4, 2.7, 3,
        3.3, 3.7, 4.1, 4.6, 5.1, 5.7, 6.3, 7, 7.7, 8.5, 9.4, 10,
      ];
      const prevScaleRatio = this.currentScaleRatio;
      if (direction === -1) {
        // enlarge
        if (this.currentScaleRatio >= factors.at(-1)!) return;
        this.currentScaleRatio = factors.filter((x) => x > this.currentScaleRatio).at(0)!;
      } else if (direction === 1) {
        // reduce
        if (this.currentScaleRatio <= factors.at(0)!) return;
        this.currentScaleRatio = factors.filter((x) => x < this.currentScaleRatio).at(-1)!;
      } else {
        return;
      }
      this.r.rescale();
      this.addViewportChange();
    };
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
      worker?.postMessage({ type: 'exportPDF', payload: { mainFilePath } });
      
    }

    function exportAsPNG() {
      alert("Export as PNG not implemented yet");
    }

    function exportAsSVG() {
      alert("Export as SVG not implemented yet");
    }

    async function exportSourcesAsZip() {
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
  let typstDoc: any | undefined;
  let renderSession: any | undefined;
  let initialized = false;
  let workerReady = false;
  let latestMainFilePath: string | null = null;
  

  // Track loaded files/assets to detect changes
  const loadedFiles = new Map<number, { path: string; content: string }>();
  const loadedAssets = new Map<number, { path: string; storage_path: string }>();

  // Initialize renderer and TypstDocument
  async function initRenderer() {
    if (initialized || !docContainer || !previewContainer) return;

    try {
      status = 'Loading typst renderer...';

      const module = await import(
        'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts/dist/esm/contrib/all-in-one-lite.bundle.js'
      );
      const typst = module.$typst;

      status = 'Configuring renderer WASM...';
      try {
        typst.setRendererInitOptions({
          getModule: () =>
            'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm',
        });
      } catch (error: any) {
        status = `Typst renderer load failed: ${error.message}`;
        console.error('Typst renderer load error:', error);
      }

      status = 'Creating render session...';

      const renderer = await typst.getRenderer();

      // DON'T await - the Promise never resolves (keeps session alive)
      renderer.runWithSession((session: any) => {
        return new Promise((dispose) => {
          renderSession = session;
          createTypstDocument();
        });
      });
    } catch (error: any) {
      status = `Renderer init failed: ${error.message}`;
      console.error('Renderer initialization error:', error);
    }
  }

  async function createTypstDocument() {
    if (!docContainer || !previewContainer) return;

    try {
      status = 'Loading TypstDocument modules...';

      // Dynamically import typst-dom modules (browser-only)
      const [typstDocModule, svgDocModule, canvasDocModule] = await Promise.all([
        import('$lib/typst-dom/src/typst-doc.mts'),
        import('$lib/typst-dom/src/typst-doc.svg.mts'),
        import('$lib/typst-dom/src/typst-doc.canvas.mts')
      ]);

      // Create SVG-only document class
      TypstSvgDocument = class extends typstDocModule.provideDoc(
        typstDocModule.composeDoc(typstDocModule.TypstDocumentContext, svgDocModule.provideSvgDoc, canvasDocModule.provideCanvasDoc)
      ) {};

      status = 'Creating TypstDocument...';

      (previewContainer as any).initTypstSvg = () => {};
      (previewContainer as any).currentPosition = () => undefined;
      (previewContainer as any).handleTypstLocation = () => {};
      (previewContainer as any).documents = [];
      (previewContainer as any).typstWebsocket = { send: async () => {} };


      typstDoc = new TypstSvgDocument({
        windowElem: previewContainer,
        hookedElem: docContainer,
        kModule: renderSession,
        renderMode: 'svg',
        previewMode: 0,
        isContentPreview: false,
        sourceMapping: false,
        retrieveDOMState: () => ({
          width: previewContainer!.clientWidth,
          height: previewContainer!.clientHeight,
          boundingRect: previewContainer!.getBoundingClientRect(),
        }),
      });

      patchTypstDocForToolbarZoom(typstDoc);

      typstDoc.setPartialRendering(true);
      previewContainer.addEventListener('scroll', handleScroll);
      // previewContainer.addEventListener('resize', handleScroll);
      // const observer = new ResizeObserver(() => {
      //   handleScroll();
      // });
      // observer.observe(previewContainer);

      // setTimeout(() => {
      //   if (typstDoc) typstDoc.addViewportChange();
      // }, 100);

      initialized = true;
      status = 'Ready';

      // Load initial files/assets and compile
      syncFilesAndAssets();
      
      // Restore saved zoom state after initialization
      if (savedLayout && typstDoc && typstDoc.impl) {
        setTimeout(() => {
          if (savedLayout.zoomMode === 'custom') {
            setZoom(savedLayout.zoomScale, 'custom');
          } else if (savedLayout.zoomMode === 'fit-width') {
            fitToWidth();
          } else if (savedLayout.zoomMode === 'fit-height') {
            fitToHeight();
          } else if (savedLayout.zoomMode === 'fit-page') {
            fitToPage();
          }
        }, 100);
      }
    } catch (error: any) {
      status = `TypstDocument creation failed: ${error.message}`;
      console.error('TypstDocument creation error:', error);
    }
  }

  function handleScroll() {
    if (!typstDoc || !initialized || !previewContainer) return;
    if ((previewContainer as any)._scrollTimeout) {
      clearTimeout((previewContainer as any)._scrollTimeout);
    }
    (previewContainer as any)._scrollTimeout = setTimeout(() => {
      typstDoc.addViewportChange();
    }, 200);
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
          const cachedBlob = await getCachedAsset(asset.project_id, asset.id, asset.storage_path);

          if (cachedBlob) {
            // Use cached data
            arrayBuffer = cachedBlob.blob;
          } else {
            // Fetch from API and cache
            const { url } = await assetsApi.getUrl(asset.project_id, asset.id);
            const response = await fetch(url);
            arrayBuffer = await response.arrayBuffer();

            // Store in IndexedDB cache (fire and forget)
            cacheAsset(asset.project_id, asset.id, asset.storage_path, asset.mime_type, arrayBuffer)
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

  // Worker Setup
  onMount(() => {
    if (!browser) return;

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
          status = 'Compiler ready - initializing renderer...';
          await initRenderer();
          break;

        case 'compiled':
          if (!initialized) {
            status = 'Waiting for renderer...';
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

            if (isFirstCompile) {
              typstDoc.addChangement(['new', vectorData]);
            } else {
              typstDoc.addChangement(['diff-v1', vectorData]);
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
          console.error('Compilation error:', e.data.error);
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

    if (latestMainFilePath !== mainFilePath) {
      latestMainFilePath = mainFilePath;
    
      if (worker && workerReady) {
        
        worker.postMessage({ type: 'reset' });
        
      }
    }

    if (workerReady && initialized) {
      syncFilesAndAssets();
    }
  });

  onDestroy(() => {
    if (previewContainer) {
      previewContainer.removeEventListener('scroll', handleScroll);
    }
    if (worker) {
      worker.terminate();
    }
  });
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
          icon={currentZoomMode === 'fit-width' ? MoveHorizontal : currentZoomMode === 'fit-height' ? MoveVertical : currentZoomMode === 'fit-page' ? File : `${Math.round(currentZoomScale * 100)}%`} 
          items={zoomItems} 
          position="middle"
          buttonWidth="45px"
          buttonBackground="var(--bg-top-bar)"
          allowIconOverflow={false}
        />
      </Tooltip>
      <Tooltip text="Zoom in" shortcut="Ctrl +" position="bottom">
        <ToolButton icon={Plus} onclick={zoomIn} position="last" />
      </Tooltip>
    </div>
    <div class="download-controls">
      <Tooltip text="Export PDF" position="bottom">
        <ToolButton icon={Download} onclick={exportAsPDF} position="first"/>
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
  <div class="preview-container" bind:this={previewContainer} class:negative-filter={shouldApplyNegativeFilter}>
    <div class="doc-container" bind:this={docContainer}></div>
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
    height: 40px;
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

  .preview-container {
    flex: 1;
    overflow: auto;
    background: var(--bg-preview);
    position: relative;
    scrollbar-gutter: stable; /* workaround for layout shift when scrollbar appears */
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  .doc-container {
    width: 100%;
    height: 100%;
    /* overflow: overlay; */
    /* transition: transform 0.2s; */
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
</style>
