<script lang="ts">
  import type { Component } from "svelte";

  interface Props {
    icon: Component;
    onclick?: () => void;
    strokeWidth?: number;
    size?: number;
    class?: string;
  }

  let { icon: Icon, onclick, size = 16, class: className }: Props = $props();
</script>

<button
  class="button {className}"
  {onclick}
  style="--icon-size: {size}px;"
>
  <Icon />
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
    stroke-width: 2;
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
    stroke-width: 2.3;
    width: var(--icon-size);
    height: var(--icon-size);
    transform: scaleY(0.8) scaleX(1.2);
  }

  .button.bold-btn :global(svg) {
    stroke-width: 3;
  }
</style>
