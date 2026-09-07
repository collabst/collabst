<script lang="ts">
  import type { Snippet } from "svelte";
  import BaseButton from "../../../ui/Button.svelte";

  interface Props {
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
    strokeWidth?: number;
    size?: number;
    title?: string;
  }

  let {
    children,
    onclick,
    strokeWidth = 2,
    size = 16,
    title,
  }: Props = $props();
</script>

<BaseButton
  class="preview-toolbar-button"
  {onclick}
  {title}
  style="--stroke-width: {strokeWidth}; --icon-size: {size}px;"
>
  {@render children()}
</BaseButton>

<style>
  :global(.ui-button.preview-toolbar-button) {
    padding: 0.25rem;
    border-radius: 5px;
  }

  :global(.ui-button.preview-toolbar-button svg) {
    stroke-width: var(--stroke-width);
    width: var(--icon-size);
    height: var(--icon-size);
  }

  :global(.ui-button.preview-toolbar-button:hover) {
    background: var(--surface-hover);
    color: var(--text-primary);
    border-color: var(--border-secondary);
  }

  :global(.ui-button.preview-toolbar-button:hover svg) {
    width: var(--icon-size);
    height: var(--icon-size);
  }

  :global(.ui-button.preview-toolbar-button:active) {
    color: var(--text-active);
  }

  :global(.ui-button.preview-toolbar-button:active svg) {
    stroke-width: 2.3;
    width: var(--icon-size);
    height: var(--icon-size);
    transform: scaleY(0.8) scaleX(1.15);
  }
</style>
