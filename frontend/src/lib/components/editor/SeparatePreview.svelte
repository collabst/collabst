<script lang="ts">
  import { onMount } from "svelte";

  interface Props {
    separateWindow: Window;
    renderSession: any;
  }

  let { separateWindow, renderSession }: Props = $props();

  let previewContainer: HTMLDivElement | undefined;
  let docContainer: HTMLDivElement | undefined;
  let TypstSvgDocument: any = null;
  let typstDoc: any | undefined;
  let initialized: boolean = false;

  onMount(async () => {
    await createTypstDocument();

    separateWindow.addEventListener("message", (event) => {
      if (event.data.type === "typst-vector-data") {
        let vectorDataEvent = event.data;
        let data = vectorDataEvent.data;
        let isFirstCompile = vectorDataEvent.isFirstCompile;

        if (isFirstCompile) {
          typstDoc.addChangement(["new", data]);
        } else {
          typstDoc.addChangement(["diff-v1", data]);
        }
      }
    });
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

      typstDoc.setPartialRendering(true);
      previewContainer.addEventListener('scroll', handleScroll);

      initialized = true;
    } catch (error: any) {
      console.error("TypstDocument creation error:", error);
    }
  }
</script>

<div class="preview-wrapper">
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
</style>
