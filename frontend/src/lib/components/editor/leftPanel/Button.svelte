<script lang="ts">
  import { type Snippet } from "svelte";
  import BaseButton from "../../ui/Button.svelte";

  interface Props {
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
    selected?: boolean;
    disabled?: boolean;
    title?: string;
  }

  let {
    children,
    onclick,
    selected = false,
    disabled = false,
    title,
  }: Props = $props();
</script>

<BaseButton
  class="left-panel-button {selected ? 'selected' : ''}"
  {onclick}
  {disabled}
  {title}
>
  {@render children()}
</BaseButton>

<style>
  :global(.ui-button.left-panel-button) {
    padding: 0.4rem 0.4rem 0.5rem 0.4rem;
    border-radius: 7px;
    border: 1px transparent solid;
  }

  :global(.ui-button.left-panel-button svg) {
    stroke-width: 2;
    width: 18px;
    height: 18px;
  }

  :global(.ui-button.left-panel-button:hover) {
    background: var(--navbar-bg);
    color: var(--text-primary);
    border-color: var(--navbar-border);

    box-shadow: inset 0px -3px 0px 0px var(--navbar-shadow);
    transform: translateY(-1px);
  }

  :global(.ui-button.left-panel-button:active),
  :global(.ui-button.left-panel-button.selected) {
    background: var(--navbar-bg);
    color: var(--text-active);
    border-color: var(--navbar-border);
    border-bottom-width: 1px;
    box-shadow: inset 0px 3px 0px 0px var(--navbar-shadow);
    transform: translateY(-1px);
  }

  :global(.ui-button.left-panel-button:active svg),
  :global(.ui-button.left-panel-button.selected svg) {
    transform: translateY(2px) scaleY(0.9) scaleX(1.1);
  }

  :global(.ui-button.left-panel-button:disabled) {
    opacity: 0.4;
  }

  :global(.ui-button.left-panel-button:disabled:hover),
  :global(.ui-button.left-panel-button:disabled:active) {
    background: none;
    border-color: transparent;
    box-shadow: none;
    transform: none;
  }

  :global(.ui-button.left-panel-button:disabled:active svg) {
    transform: none;
  }
</style>
