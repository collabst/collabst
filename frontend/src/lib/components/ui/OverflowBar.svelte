<script module lang="ts">
  import type { Snippet } from "svelte";

  /** One control in an {@link OverflowBar}. */
  export interface OverflowItem {
    /**
     * The control itself. It is rendered in the bar, and a second time in the
     * menu once it no longer fits — so keep it stateless, or give the state a
     * home outside the snippet.
     */
    render: Snippet;
    /** What the control goes by once it is in the menu. */
    label?: string;
    /**
     * A spacer rather than a control: it never becomes a menu entry, it just
     * goes away with the run of items it was separating.
     */
    separator?: boolean;
    /** A control that opens a menu of its own, so clicking it leaves this one open. */
    submenu?: boolean;
  }
</script>

<script lang="ts">
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import BaseButton from "./Button.svelte";

  /**
   * A row of controls that folds its tail into a "more options" menu as soon as
   * the row runs out of width.
   *
   * The bar is the styled element itself — the toolbar pill, the nav bar, the
   * header's button group — not a wrapper inside one. It has to be: the room it
   * has is what its *parent* leaves it, and a parent that hugged the bar would
   * shrink every time an item collapsed, which would collapse the next one.
   * That is also why the caller styles it from the outside, through
   * `:global(.overflow-bar.<their-class>)`, the same way the regional buttons
   * style `ui/Button.svelte`.
   *
   * Collapsed items stay in the bar, taken out of flow and hidden: they cost
   * nothing there, and they are the only honest answer to "how wide would this
   * be if it came back?".
   */
  interface Props {
    items: OverflowItem[];
    /** Which way the menu opens. A bar at the bottom of its panel wants "up". */
    direction?: "down" | "up";
    class?: string;
    /** The trigger, so each bar can hand over a button that matches its own. */
    more?: Snippet<[{ onclick: (event: MouseEvent) => void; open: boolean }]>;
    onwheel?: (event: WheelEvent) => void;
  }

  let {
    items,
    direction = "down",
    class: className = "",
    more,
    onwheel,
  }: Props = $props();

  let bar: HTMLDivElement | undefined = $state();
  let moreSlot: HTMLDivElement | undefined = $state();
  let itemEls: Array<HTMLDivElement | undefined> = $state([]);
  /**
   * How many leading items are laid out in the bar; the rest are in the menu.
   * Everything, until the bar has been measured for the first time.
   */
  let visibleCount = $state(Infinity);
  let menuOpen = $state(false);

  let collapsed = $derived(visibleCount < items.length);

  /** The width the bar's items have to share, once its own frame is paid for. */
  function room(view: Window & typeof globalThis): number {
    const container = bar?.parentElement;
    if (!bar || !container) return 0;

    const style = view.getComputedStyle(container);
    const gap = parseFloat(style.columnGap) || 0;
    let space =
      container.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);

    // Whatever else shares the row with the bar — the "Files" title beside the
    // header's buttons, say — is width the bar will not get.
    for (const sibling of container.children) {
      if (sibling === bar) continue;
      const siblingStyle = view.getComputedStyle(sibling);
      if (
        siblingStyle.display === "none" ||
        siblingStyle.position === "absolute" ||
        siblingStyle.position === "fixed"
      )
        continue;
      space -=
        sibling.getBoundingClientRect().width +
        parseFloat(siblingStyle.marginLeft) +
        parseFloat(siblingStyle.marginRight) +
        gap;
    }

    const barStyle = view.getComputedStyle(bar);
    return (
      space -
      parseFloat(barStyle.marginLeft) -
      parseFloat(barStyle.marginRight) -
      parseFloat(barStyle.borderLeftWidth) -
      parseFloat(barStyle.borderRightWidth) -
      parseFloat(barStyle.paddingLeft) -
      parseFloat(barStyle.paddingRight)
    );
  }

  function measure() {
    if (!bar) return;
    const view = bar.ownerDocument.defaultView;
    if (!view) return;

    const space = room(view);
    const gap = parseFloat(view.getComputedStyle(bar).columnGap) || 0;
    // `offsetWidth` rather than the bounding rect: a button caught mid-hover is
    // scaled by a transform, and its natural width is what we are after.
    const widths = items.map((_, i) => itemEls[i]?.offsetWidth ?? 0);
    const total = widths.reduce(
      (sum, width, i) => sum + width + (i > 0 ? gap : 0),
      0,
    );

    if (total <= space) {
      visibleCount = items.length;
      return;
    }

    // A rounding-error's worth of slack, so a bar that fits exactly does not
    // flicker an empty menu into being.
    const reserve = (moreSlot?.offsetWidth ?? 0) + gap - 0.5;
    let used = 0;
    let count = 0;
    for (let i = 0; i < widths.length; i++) {
      const width = widths[i] + (count > 0 ? gap : 0);
      if (used + width + reserve > space) break;
      used += width;
      count++;
    }
    // A separator left dangling at the end separates nothing.
    while (count > 0 && items[count - 1].separator) count--;
    visibleCount = count;
  }

  let frame = 0;

  function schedule() {
    const view = bar?.ownerDocument.defaultView;
    if (!view) return;
    if (frame) view.cancelAnimationFrame(frame);
    frame = view.requestAnimationFrame(() => {
      frame = 0;
      measure();
    });
  }

  // The bar is remeasured when its room changes and when its contents do — the
  // compile status growing a longer word is as good a reason as a dragged
  // panel handle.
  $effect(() => {
    const container = bar?.parentElement;
    const view = bar?.ownerDocument.defaultView;
    if (!bar || !container || !view) return;

    const observer = new view.ResizeObserver(schedule);
    observer.observe(container);
    observer.observe(bar);
    if (moreSlot) observer.observe(moreSlot);
    for (const element of itemEls) if (element) observer.observe(element);

    schedule();
    return () => {
      if (frame) view.cancelAnimationFrame(frame);
      frame = 0;
      observer.disconnect();
    };
  });

  // Nothing left to show: the trigger is on its way out, so the menu goes first.
  $effect(() => {
    if (!collapsed) menuOpen = false;
  });

  // The popup preview window is a document of its own, and `svelte:window` is
  // not the window the toolbar was mounted into.
  $effect(() => {
    if (!menuOpen || !bar) return;
    const doc = bar.ownerDocument;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") menuOpen = false;
    };
    doc.addEventListener("keydown", close);
    return () => doc.removeEventListener("keydown", close);
  });

  function toggle(event: MouseEvent) {
    event.stopPropagation();
    menuOpen = !menuOpen;
  }

  /**
   * The menu row is wider than the button it holds, so a click that lands
   * beside the button — on the label, or the padding — is passed to it.
   *
   * The click stops here. A control that opens a menu of its own arms a
   * "next click anywhere closes me" listener as it opens, and this very click,
   * left to carry on up to the window, would be that next one.
   */
  function activate(item: OverflowItem, event: MouseEvent) {
    event.stopPropagation();
    const row = event.currentTarget as HTMLElement;
    const control = row.querySelector<HTMLElement>("button, a");
    if (control instanceof HTMLButtonElement && control.disabled) return;
    if (control && !control.contains(event.target as Node)) control.click();
    if (!item.submenu) menuOpen = false;
  }
</script>

<div class="overflow-bar {className}" bind:this={bar} {onwheel}>
  {#each items as item, i (i)}
    <div class="ob-item" class:ob-away={i >= visibleCount} bind:this={itemEls[i]}>
      {@render item.render()}
    </div>
  {/each}

  <div class="ob-more" class:ob-away={!collapsed} bind:this={moreSlot}>
    {#if more}
      {@render more({ onclick: toggle, open: menuOpen })}
    {:else}
      <BaseButton
        class="ob-more-button"
        onclick={toggle}
        title="More options"
        ariaLabel="More options"
      >
        <Ellipsis />
      </BaseButton>
    {/if}

    {#if menuOpen}
      <button
        class="ob-backdrop"
        aria-label="Close menu"
        onclick={() => (menuOpen = false)}
      ></button>
      <div class="ob-menu" class:up={direction === "up"}>
        {#each items as item, i (i)}
          {#if i >= visibleCount && !item.separator}
            <div
              class="ob-menu-item"
              role="presentation"
              onclick={(event) => activate(item, event)}
            >
              {@render item.render()}
              {#if item.label}<span class="ob-menu-label">{item.label}</span>{/if}
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .overflow-bar {
    display: flex;
    /* Holds the items that no longer fit, which are placed against it. */
    position: relative;
    min-width: 0;
  }

  .ob-item,
  .ob-more {
    display: flex;
    /* The bar's own cross-axis rule, so wrapping an item does not move it. */
    align-items: inherit;
    align-self: stretch;
    flex: 0 0 auto;
  }

  .ob-more {
    position: relative;
  }

  /*
    Collapsed, but not gone: out of flow it costs the row nothing while staying
    measurable, which is what tells us when it can come back.
  */
  .ob-item.ob-away,
  .ob-more.ob-away {
    position: absolute;
    top: 0;
    left: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .ob-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    border: none;
    background: transparent;
    cursor: default;
  }

  .ob-menu {
    position: absolute;
    z-index: 41;
    top: calc(100% + 0.45rem);
    right: 0;
    display: flex;
    flex-direction: column;
    min-width: 9rem;
    padding: 0.35rem;
    border: 1px solid var(--navbar-border);
    border-radius: 0.75rem;
    background-color: color-mix(in srgb, var(--navbar-bg), transparent 10%);
    backdrop-filter: blur(12px);
    box-shadow:
      0 3px 0 0 var(--navbar-shadow),
      0 12px 28px -12px rgb(0 0 0 / 0.35);
  }

  .ob-menu.up {
    top: auto;
    bottom: calc(100% + 0.45rem);
  }

  .ob-menu-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.25rem 0.4rem;
    border-radius: 0.5rem;
    cursor: pointer;
  }

  .ob-menu-label {
    color: var(--text-secondary);
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .ob-menu-item:hover {
    background-color: var(--surface-hover);
  }

  .ob-menu-item:hover .ob-menu-label {
    color: var(--text-primary);
  }

  /* The control keeps its own disabled look; the row follows it. */
  .ob-menu-item:has(:global(:disabled)) {
    cursor: default;
  }

  .ob-menu-item:has(:global(:disabled)):hover {
    background: none;
  }

  .ob-menu-item:has(:global(:disabled)) .ob-menu-label {
    opacity: 0.4;
  }

  :global(.ui-button.ob-more-button svg) {
    width: 16px;
    height: 16px;
    stroke-width: 2;
  }
</style>
