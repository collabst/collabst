<script lang="ts">
  import type { Snippet } from "svelte";
  import BaseButton from "../../../ui/Button.svelte";

  interface Props {
    children: Snippet;
    onclick?: () => void;
    strokeWidth?: number;
    size?: number;
    class?: string;
    disabled?: boolean;
    title?: string;
  }

  let {
    children,
    onclick,
    size = 16,
    class: className = "",
    disabled = false,
    title,
  }: Props = $props();
</script>

<BaseButton
  class="editor-toolbar-button {className}"
  {onclick}
  {disabled}
  {title}
  style="--icon-size: {size}px;"
>
  {@render children()}
</BaseButton>

<style>
  :global(.ui-button.editor-toolbar-button) {
    padding: 0.25rem;
    border-radius: 5px;
  }

  :global(.ui-button.editor-toolbar-button svg) {
    stroke-width: 2;
    width: var(--icon-size);
    height: var(--icon-size);
  }

  :global(.ui-button.editor-toolbar-button:hover) {
    background: var(--surface-hover);
    color: var(--text-primary);
    border-color: var(--border-secondary);
  }

  :global(.ui-button.editor-toolbar-button:hover svg) {
    width: var(--icon-size);
    height: var(--icon-size);
  }

  :global(.ui-button.editor-toolbar-button:active) {
    color: var(--text-active);
  }

  :global(.ui-button.editor-toolbar-button:active svg) {
    stroke-width: 2.3;
    width: var(--icon-size);
    height: var(--icon-size);
    transform: scaleY(0.8) scaleX(1.2);
  }

  :global(.ui-button.editor-toolbar-button.bold-btn svg) {
    stroke-width: 3;
  }

  :global(.ui-button.editor-toolbar-button:disabled) {
    opacity: 0.4;
  }

  :global(.ui-button.editor-toolbar-button:disabled:hover) {
    background: none;
  }

  :global(.ui-button.editor-toolbar-button:disabled:active) {
    color: var(--text-primary);
  }

  :global(.ui-button.editor-toolbar-button:disabled:active svg) {
    stroke-width: 2;
    transform: none;
  }
</style>
