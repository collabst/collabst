<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
    /**
     * Fixed width in pixels. Without it the panel is the row's elastic column:
     * the one that absorbs whatever the fixed ones beside it leave over.
     */
    width?: number;
    /**
     * Whether a fixed-width column gives width back when the row runs out of it.
     * The elastic column stops at its own `minWidth`, so without this the row
     * would simply overflow instead.
     */
    shrinkable?: boolean;
    /** The width the panel will not go below, in pixels. */
    minWidth?: number;
  }

  let { children, width, shrinkable = false, minWidth = 0 }: Props = $props();

  // A `flex-basis` of 0 on the elastic column is what makes the two handles
  // independent: with no basis to share out proportionally, both growth and
  // shrinkage land on this one panel and the fixed columns keep the width they
  // were given.
  let flex = $derived(
    width === undefined ? "1 1 0" : `0 ${shrinkable ? 1 : 0} auto`,
  );
</script>

<div
  class="panel"
  style="flex: {flex}; min-width: {minWidth}px;{width === undefined
    ? ''
    : ` width: ${width}px;`}"
>
  {@render children()}
</div>

<style>
  .panel {
    border: 1px solid var(--editor-panels-border);
    border-radius: 1rem;
    overflow: hidden;
    height: 100%;
  }
</style>
