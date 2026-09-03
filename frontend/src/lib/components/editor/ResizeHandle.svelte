<script lang="ts">
  interface Props {
    /**
     * Called during a drag with the horizontal delta since it started, plus the
     * widths the two neighbouring panels had at that moment. The handle sits
     * between them, so it is the one place those are cheap to measure — the
     * caller never has to reason about gaps or padding.
     */
    onresize: (deltaX: number, startBefore: number, startAfter: number) => void;
    ariaLabel: string;
  }

  let { onresize, ariaLabel }: Props = $props();

  let element: HTMLButtonElement | undefined = $state();
  let dragging = $state(false);
  let startX = 0;
  let startBefore = 0;
  let startAfter = 0;

  function measure() {
    startBefore = (element?.previousElementSibling as HTMLElement)?.offsetWidth ?? 0;
    startAfter = (element?.nextElementSibling as HTMLElement)?.offsetWidth ?? 0;
  }

  function handlePointerDown(event: PointerEvent) {
    dragging = true;
    startX = event.clientX;
    measure();
    // Pointer capture keeps the moves coming even when the cursor outruns the
    // handle, which is what the old drag-overlay div was working around.
    element?.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: PointerEvent) {
    if (!dragging) return;
    onresize(event.clientX - startX, startBefore, startAfter);
  }

  function handlePointerUp(event: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    element?.releasePointerCapture(event.pointerId);
  }

  // Keyboard resizing, so the split is not mouse-only.
  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 40 : 10);
    measure();
    onresize(step, startBefore, startAfter);
  }
</script>

<!--
  A button rather than a `div` with `role="separator"`: the splitter has to be
  focusable and take arrow keys, which a button is for free. Svelte's a11y rules
  reject `role="separator"` on an interactive element, so the label carries the
  meaning instead.
-->
<button
  bind:this={element}
  type="button"
  class="handle"
  class:dragging
  aria-label={ariaLabel}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  onkeydown={handleKeydown}
>
  <span class="grip"></span>
</button>

<style>
  .handle {
    padding: 0;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--space, 0.5rem);
    flex: none;
    cursor: col-resize;
    touch-action: none;
  }

  .grip {
    width: 2px;
    height: 2.5rem;
    border-radius: 999px;
    background-color: transparent;
  }

  .handle:hover .grip,
  .handle:focus-visible .grip,
  .handle.dragging .grip {
    background-color: var(--navbar-border);
  }

  .handle:focus-visible {
    outline: none;
  }
</style>
