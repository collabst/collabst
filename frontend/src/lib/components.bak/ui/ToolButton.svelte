<script lang="ts">
  import type { Component } from "svelte";

  interface ToolButtonProps {
    icon: Component;
    onclick?: () => void;
    disabled?: boolean;
    active?: boolean;
    class?: string;
    position?: "standalone" | "first" | "middle" | "last";
    strokeWidth?: number;
  }

  let {
    icon,
    onclick,
    disabled = false,
    active = false,
    class: className = "",
    position = "standalone",
    strokeWidth = 2,
  }: ToolButtonProps = $props();

  const Icon = $derived(icon);
</script>

<button
  type="button"
  {disabled}
  class="tool-btn tool-btn-{position} {active
    ? 'tool-btn-active'
    : ''} {className}"
  {onclick}
>
  <Icon size={16} {strokeWidth} />
</button>

<style>
  .tool-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    background: var(--bg-editor);
    border: 1px solid var(--border-primary);
    color: var(--text-secondary);
    cursor: pointer;
    user-select: none;
    min-width: 30px;
    height: 30px;
  }

  .tool-btn:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text-primary);
    border-color: var(--border-secondary);
  }

  .tool-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tool-btn:active:not(:disabled) {
    background: var(--surface-active);
    color: var(--text-active);
    transform: scaleY(0.92) scaleX(0.95) translateY(1px);
  }

  /* Position variants - handle border radius and margins */
  .tool-btn-standalone {
    border-radius: var(--radius-md);
  }

  .tool-btn-first {
    border-top-left-radius: var(--radius-md);
    border-bottom-left-radius: var(--radius-md);
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    border-right: none;
  }

  .tool-btn-middle {
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .tool-btn-last {
    border-top-right-radius: var(--radius-md);
    border-bottom-right-radius: var(--radius-md);
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-left: none;
  }
</style>
