<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
    sizeWeight?: number;
    /** Fixed width in pixels. When set, the panel is a column, not a flex share. */
    width?: number;
  }

  let { children, sizeWeight = 1, width }: Props = $props();
</script>

<div
  class="panel"
  style={width === undefined
    ? `flex: ${sizeWeight};`
    : `flex: none; width: ${width}px;`}
>
  {@render children()}
</div>

<style>
  .panel {
    border: 1px solid var(--editor-panels-border);
    border-radius: 1rem;
    overflow: hidden;
    height: 100%;
    min-width: 0;
  }
</style>
