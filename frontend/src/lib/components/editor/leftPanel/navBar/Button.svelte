<script lang="ts">
  import type { Snippet } from "svelte";
  import BaseButton from "../../../ui/Button.svelte";

  interface Props {
    children: Snippet;
    onclick?: (event: MouseEvent) => void;
    strokeWidth?: number;
    size?: number;
    width?: string;
    selected?: boolean;
    title?: string;
  }

  let {
    children,
    onclick,
    strokeWidth = 2,
    size = 24,
    width = "2.6rem",
    selected = false,
    title,
  }: Props = $props();
</script>

<BaseButton
  class="navbar-button {selected ? 'selected' : ''}"
  {onclick}
  {title}
  style="--stroke-width: {strokeWidth}; --icon-size: {size}px; --width: {width};"
>
  {@render children()}
</BaseButton>

<style>
  :global(.ui-button.navbar-button) {
    border-radius: 0.8rem;
    width: var(--width);
    height: var(--width);
  }

  :global(.ui-button.navbar-button svg) {
    stroke-width: var(--stroke-width);
    width: var(--icon-size);
    height: var(--icon-size);
  }

  :global(.ui-button.navbar-button:hover svg) {
    animation: icon-jump 0.2s ease-out;
  }

  :global(.ui-button.navbar-button:hover) {
    border: 1px solid var(--navbar-border);
  }

  :global(.ui-button.navbar-button.selected) {
    border: 1px solid var(--navbar-border);
    box-shadow: inset 0px -4px 0px 0px var(--navbar-shadow);
    animation: nav-button-jump 0.2s ease-out;
    height: calc(var(--width) + 2px);
    margin-top: -2px;
  }

  :global(.ui-button.navbar-button.selected svg) {
    animation: icon-jump-delayed 0.2s ease-out;
    transform: translateY(-1px);
  }

  :global(.ui-button.navbar-button:active) {
    border: 1px solid var(--navbar-border);
    box-shadow: inset 0px 4px 0px 0px var(--navbar-shadow);
    height: var(--width);
    margin-top: 0px;
  }

  :global(.ui-button.navbar-button:active svg) {
    transform: translateY(3px);
  }
</style>
