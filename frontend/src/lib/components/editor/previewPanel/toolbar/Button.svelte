<script lang="ts">
  import type { Component, Snippet } from "svelte";

  interface Props {
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
    strokeWidth?: number;
    size?: number;
  }

  let { children, onclick, strokeWidth = 2, size = 16 }: Props = $props();
</script>

<button
  class="button"
  {onclick}
  style="--stroke-width: {strokeWidth}; --icon-size: {size}px;"
>
  {@render children()}
</button>

<style>
  .button {
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
    border-radius: 5px;
  }

  .button :global(svg) {
    stroke-width: var(--stroke-width);
    width: var(--icon-size);
    height: var(--icon-size);
  }

  .button:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
    border-color: var(--border-secondary);
  }

  .button:hover :global(svg) {
    width: var(--icon-size);
    height: var(--icon-size);
  }

  .button:active {
    color: var(--text-active);
    /* transform: scaleX(1.15); */
  }

  .button:active :global(svg) {
    stroke-width: 3;
    width: var(--icon-size);
    height: var(--icon-size);
    transform: scaleY(0.85) scaleX(1.1) translateY(1px);
  }
</style>
