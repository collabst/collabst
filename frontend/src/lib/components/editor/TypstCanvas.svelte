<script lang="ts">
  // Typst preview surface: one <canvas> per page, driven by the shared Core.
  import { onDestroy, untrack } from 'svelte'
  import { renderToCanvas, type Core, type PageInfo } from '@mudomi/onykia-engine'

  type ZoomMode = 'fit-width' | 'fit-height' | 'fit-page' | 'custom'

  let {
    core,
    negative = false,
    initialZoomMode = 'custom',
    initialZoom = 1,
    onZoomChange,
  }: {
    core: Core | null
    negative?: boolean
    initialZoomMode?: ZoomMode
    initialZoom?: number
    onZoomChange?: (zoom: number, mode: ZoomMode) => void
  } = $props()

  const ZOOM_MIN = 0.1
  const ZOOM_MAX = 5
  const ZOOM_STEP = 0.25
  // Exponential factor per wheel pixel; ~14% per clamped tick.
  const WHEEL_ZOOM_K = 0.003
  const WHEEL_DELTA_CLAMP = 50
  // Trailing debounce before re-raster; transient CSS scale covers the gap.
  const RENDER_DEBOUNCE_MS = 140

  let pages: PageInfo[] = $state([])
  let hasRendered = $state(false)
  let pageContainer: HTMLDivElement | undefined = $state()
  let pageLayer: HTMLDivElement | undefined = $state()

  let zoomMode: ZoomMode = untrack(() => initialZoomMode)
  let currentZoom = untrack(() => initialZoom)
  // Zoom the canvases were last rasterised at; transient scale = currentZoom / renderedZoom.
  let renderedZoom: number | null = null

  let rendering = false
  let renderQueued = false
  let renderDebounceTimer: ReturnType<typeof setTimeout> | undefined
  let resizeDebounceTimer: ReturnType<typeof setTimeout> | undefined

  // untrack so re-renders don't re-subscribe.
  const engine = untrack(() => core)
  let offPages: (() => void) | undefined
  if (engine) {
    offPages = engine.onPages(({ pages: p }) => {
      pages = p
      scheduleRender(0)
    })
  }

  function transientScale(): number {
    return renderedZoom !== null && renderedZoom > 0 ? currentZoom / renderedZoom : 1
  }

  function applyTransientScale() {
    if (!pageLayer) return
    const s = transientScale()
    pageLayer.style.transform = Math.abs(s - 1) < 0.001 ? '' : `scale(${s.toFixed(4)})`
  }

  function scheduleRender(debounceMs: number) {
    clearTimeout(renderDebounceTimer)
    if (debounceMs > 0) renderDebounceTimer = setTimeout(() => void render(), debounceMs)
    else void render()
  }

  // Resolve the active mode to a concrete zoom. Always pass `{ zoom }` (never
  // `{ fit: 'width' }`) so the engine doesn't read layout from our detached
  // scratch container.
  function sizingForRender(): { zoom: number } {
    if (zoomMode === 'custom') return { zoom: currentZoom }

    const container = pageContainer
    const first = pages[0]
    if (!container || !first || first.width <= 0 || first.height <= 0) {
      return { zoom: currentZoom }
    }
    const style = getComputedStyle(container)
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    const availW = Math.max(1, container.clientWidth - padX)
    const availH = Math.max(1, container.clientHeight - padY)
    if (zoomMode === 'fit-width') return { zoom: availW / first.width }
    if (zoomMode === 'fit-height') return { zoom: availH / first.height }
    return { zoom: Math.min(availW / first.width, availH / first.height) }
  }

  // Scale scroll so the document point at (focalX, focalY) stays put.
  function scrollAroundFocus(prevScale: number, nextScale: number, focalX: number, focalY: number) {
    if (!pageContainer) return
    const rect = pageContainer.getBoundingClientRect()
    const px = focalX - rect.left + pageContainer.scrollLeft
    const py = focalY - rect.top + pageContainer.scrollTop
    const ratio = nextScale / prevScale
    pageContainer.scrollLeft = px * ratio - (focalX - rect.left)
    pageContainer.scrollTop = py * ratio - (focalY - rect.top)
  }

  async function render() {
    if (!engine || !pageLayer || pages.length === 0) return
    if (rendering) {
      renderQueued = true
      return
    }
    rendering = true
    try {
      do {
        renderQueued = false
        const sizing = sizingForRender()

        const scratch = document.createElement('div')
        await renderToCanvas(engine, { container: scratch, pages, ...sizing })
        if (!pageLayer) return

        pageLayer.replaceChildren(...Array.from(scratch.children))
        pageLayer.style.transform = ''
        renderedZoom = sizing.zoom
        currentZoom = sizing.zoom
        hasRendered = true
        onZoomChange?.(currentZoom, zoomMode)
      } while (renderQueued)
    } catch (err) {
      console.warn('[typst-canvas] render failed', err)
    } finally {
      rendering = false
    }
  }

  function clampZoom(v: number): number {
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v))
  }

  // Imperative API for the toolbar

  export function setZoom(value: number) {
    const next = clampZoom(value)
    if (next === currentZoom && zoomMode === 'custom') return
    // Anchor at the container centre.
    if (pageContainer) {
      const rect = pageContainer.getBoundingClientRect()
      const before = transientScale()
      currentZoom = next
      zoomMode = 'custom'
      const after = transientScale()
      scrollAroundFocus(before, after, rect.left + rect.width / 2, rect.top + rect.height / 2)
    } else {
      currentZoom = next
      zoomMode = 'custom'
    }
    applyTransientScale()
    onZoomChange?.(currentZoom, zoomMode)
    scheduleRender(RENDER_DEBOUNCE_MS)
  }
  export function zoomIn() {
    setZoom((zoomMode === 'custom' ? currentZoom : renderedZoom ?? 1) + ZOOM_STEP)
  }
  export function zoomOut() {
    setZoom((zoomMode === 'custom' ? currentZoom : renderedZoom ?? 1) - ZOOM_STEP)
  }
  export function fitWidth() { setFitMode('fit-width') }
  export function fitHeight() { setFitMode('fit-height') }
  export function fitPage() { setFitMode('fit-page') }
  function setFitMode(mode: ZoomMode) {
    if (pageLayer) pageLayer.style.transform = ''
    zoomMode = mode
    scheduleRender(0)
  }

  function normalizeWheelDelta(e: WheelEvent): number {
    let dy = e.deltaY
    if (e.deltaMode === 1) dy *= 16
    else if (e.deltaMode === 2) dy *= 100
    return Math.max(-WHEEL_DELTA_CLAMP, Math.min(WHEEL_DELTA_CLAMP, dy))
  }

  function onWheel(e: WheelEvent) {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    const dy = normalizeWheelDelta(e)
    const base = zoomMode === 'custom' ? currentZoom : renderedZoom ?? 1
    const next = clampZoom(base * Math.exp(-dy * WHEEL_ZOOM_K))
    if (next === currentZoom && zoomMode === 'custom') return

    const before = transientScale()
    currentZoom = next
    zoomMode = 'custom'
    const after = transientScale()
    scrollAroundFocus(before, after, e.clientX, e.clientY)
    applyTransientScale()
    onZoomChange?.(currentZoom, zoomMode)
    scheduleRender(RENDER_DEBOUNCE_MS)
  }

  // Re-fit on container resize.
  $effect(() => {
    if (!pageContainer) return
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeDebounceTimer)
      resizeDebounceTimer = setTimeout(() => void render(), 80)
    })
    observer.observe(pageContainer)
    return () => {
      observer.disconnect()
      clearTimeout(resizeDebounceTimer)
      clearTimeout(renderDebounceTimer)
    }
  })

  onDestroy(() => {
    offPages?.()
  })
</script>

<div
  class="typst-pages"
  class:negative
  bind:this={pageContainer}
  onwheel={onWheel}
  role="document"
>
  <div bind:this={pageLayer} class="page-layer"></div>

  {#if !hasRendered}
    <p class="placeholder">Waiting for first compile…</p>
  {/if}
</div>

<style>
  .typst-pages {
    width: 100%;
    height: 100%;
    overflow: auto;
    padding: var(--space-5, 20px);
    box-sizing: border-box;
    background: var(--bg-preview, #f5f5f5);
  }

  .page-layer {
    transform-origin: 0 0;
    will-change: transform;
  }

  .typst-pages :global(canvas) {
    background: white;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    display: block;
    margin: 0 auto 16px;
  }

  .typst-pages.negative :global(canvas) {
    filter: invert(1) hue-rotate(180deg);
  }

  .placeholder {
    text-align: center;
    margin-top: 2.5rem;
    color: var(--text-muted, #888);
    font-size: var(--font-size-sm, 0.875rem);
  }
</style>
