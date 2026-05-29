<script lang="ts">
  import type { Component } from "svelte";

  interface Props {
    icon: Component;
    onclick?: () => void;
    strokeWidth?: number;
    size?: number;
  }

  let { icon: Icon, onclick, strokeWidth = 2, size = 16 }: Props = $props();
</script>

<button
  class="button"
  {onclick}
  style="--stroke-width: {strokeWidth}; --icon-size: {size}px;"
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
  }

  .button:hover {
    background-color: var(--bg-secondary);
  }

  :global(.button svg) {
    stroke-width: var(--stroke-width);
    width: var(--icon-size);
    height: var(--icon-size);
  }
</style>
