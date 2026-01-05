<script lang="ts">
  import { onMount } from "svelte";
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

  // Own render session for separate preview
  let renderSession: any = null;

  let previewContainer: HTMLDivElement | undefined;
  let docContainer: HTMLDivElement | undefined;
  let TypstSvgDocument: any = null;
  let typstDoc: any | undefined;
  let initialized: boolean = false;

  // Queue for messages that arrive before initialization
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

  // --- Zoom Logic ---
  function updateZoomStateFromTypst() {
    if (typstDoc && typstDoc.impl) {
      currentZoomScale = typstDoc.impl.currentScaleRatio;
      currentZoomMode = 'custom';
    }
  }

  function zoomIn() {
    if (typstDoc && typstDoc.impl) {
      typstDoc.impl.__doRescaleFromToolbar?.(-1);
      updateZoomStateFromTypst();
    }
  }

  function zoomOut() {
    if (typstDoc && typstDoc.impl) {
      typstDoc.impl.__doRescaleFromToolbar?.(1);
      updateZoomStateFromTypst();
    }
  }

  function setZoom(scale: number, mode: 'fit-width' | 'fit-height' | 'fit-page' | 'custom' = 'custom') {
    if (typstDoc && typstDoc.impl) {
      typstDoc.impl.currentScaleRatio = scale;
      typstDoc.impl.r.rescale();
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
    typstDoc.impl.__doRescaleFromToolbar = function(direction: number) {
      const factors = [
        0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.3, 1.5, 1.7, 1.9, 2.1, 2.4, 2.7, 3,
        3.3, 3.7, 4.1, 4.6, 5.1, 5.7, 6.3, 7, 7.7, 8.5, 9.4, 10,
      ];
      const prevScaleRatio = this.currentScaleRatio;
      if (direction === -1) {
        if (this.currentScaleRatio >= factors.at(-1)!) return;
        this.currentScaleRatio = factors.filter((x) => x > this.currentScaleRatio).at(0)!;
      } else if (direction === 1) {
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

  const exportItems = [
    { label: "Export as PDF", onclick: () => onExportPDF() },
    { label: "Export as PNG", onclick: () => onExportPNG() },
    { label: "Export as SVG", onclick: () => onExportSVG(), separator: true },
    { label: "Export sources as ZIP", onclick: () => onExportSourcesAsZip() },
  ];

  onMount(async () => {
    // Set up message listener first to queue messages
    separateWindow.addEventListener("message", (event) => {
      if (event.data.type === "typst-vector-data") {
        let vectorDataEvent = event.data;
        let data = vectorDataEvent.data;
        let isFirstCompile = vectorDataEvent.isFirstCompile;

        if (initialized && typstDoc) {
          // Process immediately if initialized
          if (isFirstCompile) {
            typstDoc.addChangement(["new", data]);
          } else {
            typstDoc.addChangement(["diff-v1", data]);
          }
        } else {
          // Queue message for later processing
          messageQueue.push({ data, isFirstCompile });
        }
      }
    });

    // Now create the document (will process queued messages when done)
    await createTypstDocument();
  });

  function handleScroll() {
    if (!typstDoc || !initialized || !previewContainer) return;
    if ((previewContainer as any)._scrollTimeout) {
      clearTimeout((previewContainer as any)._scrollTimeout);
    }
    (previewContainer as any)._scrollTimeout = setTimeout(() => {
      typstDoc.addViewportChange();
    }, 200);
  }

  async function createTypstDocument() {
    if (!docContainer || !previewContainer) return;

    try {
      // Dynamically import typst modules and create own render session
      const typstModule = await import(
        'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts/dist/esm/contrib/all-in-one-lite.bundle.js'
      );
      const typst = typstModule.$typst;

      // Renderer is a singleton - it may already be initialized by PreviewPane
      try {
        typst.setRendererInitOptions({
          getModule: () =>
            'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm',
        });
      } catch (e) {
        // Renderer already initialized, that's fine - we'll reuse it
        console.log('SeparatePreview: Renderer already initialized, reusing');
      }

      const renderer = await typst.getRenderer();

      // Create our own render session
      renderer.runWithSession(async (session: any) => {
        renderSession = session;

        // Dynamically import typst-dom modules (browser-only)
        const [typstDocModule, svgDocModule, canvasDocModule] = await Promise.all(
          [
            import("$lib/typst-dom/src/typst-doc.mts"),
            import("$lib/typst-dom/src/typst-doc.svg.mts"),
            import("$lib/typst-dom/src/typst-doc.canvas.mts"),
          ]
        );

        // Create SVG-only document class
        TypstSvgDocument = class extends (
          typstDocModule.provideDoc(
            typstDocModule.composeDoc(
              typstDocModule.TypstDocumentContext,
              svgDocModule.provideSvgDoc,
              canvasDocModule.provideCanvasDoc
            )
          )
        ) {};

        (previewContainer as any).initTypstSvg = () => {};
        (previewContainer as any).currentPosition = () => undefined;
        (previewContainer as any).handleTypstLocation = () => {};
        (previewContainer as any).documents = [];
        (previewContainer as any).typstWebsocket = { send: async () => {} };

        typstDoc = new TypstSvgDocument({
          windowElem: previewContainer,
          hookedElem: docContainer,
          kModule: renderSession,
          renderMode: "svg",
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
        previewContainer!.addEventListener('scroll', handleScroll);

        initialized = true;

        // Process any queued messages
        for (const msg of messageQueue) {
          if (msg.isFirstCompile) {
            typstDoc.addChangement(["new", msg.data]);
          } else {
            typstDoc.addChangement(["diff-v1", msg.data]);
          }
        }
        messageQueue = [];

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

        // Keep the session alive - return a Promise that never resolves
        return new Promise(() => {});
      });
    } catch (error: any) {
      console.error("SeparatePreview: TypstDocument creation error:", error);
    }
  }
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
  <div class="preview-container" bind:this={previewContainer}>
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
    padding: var(--space-1);
  }

  .preview-toolbar {
    height: 40px;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px var(--space-2) 8px;
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
  }
</style>
