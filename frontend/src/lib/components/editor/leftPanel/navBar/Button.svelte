<script lang="ts">
  import type { Component } from "svelte";

  interface Props {
    icon: Component;
    onclick?: () => void;
    strokeWidth?: number;
    size?: number;
    selected?: boolean;
  }

  let { icon: Icon, onclick, strokeWidth = 2, size = 24, selected = false }: Props = $props();
</script>

<button
  class="button" class:selected={selected}
  {onclick}
  style="--stroke-width: {strokeWidth}; --icon-size: {size}px;"
>
    <Icon />
</button>

<style>
  .button {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
    border-radius: 0.8rem;
    box-sizing: border-box;
    width: 3rem;
    height: 3rem;
  }

  .button:hover {
    background-color: var(--bg-secondary);
  }

  :global(.button svg) {
    stroke-width: var(--stroke-width);
    width: var(--icon-size);
    height: var(--icon-size);
  }

  .button.selected {
    border: 1px solid #00ac97;
    box-shadow: inset 0px -4px 0px 0px #03493133;
  }
</style>
