<script lang="ts">
  import { type Snippet } from "svelte";
  import BaseButton from "../../../ui/Button.svelte";

  interface Props {
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
    selected?: boolean;
    class?: string;
  }

  let { children, onclick, selected = false, class: className = "" }: Props = $props();
</script>

<BaseButton
  class="search-button {className} {selected ? 'selected' : ''}"
  {onclick}
>
  {@render children()}
</BaseButton>

<style>
  :global(.ui-button.search-button) {
    padding: 0.25rem;
    color: var(--text-secondary);
    border-radius: 5px;
  }

  :global(.ui-button.search-button svg) {
    stroke-width: 2;
    width: 16px;
    height: 16px;
  }

  :global(.ui-button.search-button:hover) {
    color: var(--text-active);
  }

  :global(.ui-button.search-button:hover svg) {
    stroke-width: 2.4;
    transform: scale(1.05);
  }

  :global(.ui-button.search-button:active svg) {
    transform: scaleY(0.9) scaleX(1.2);
  }

  :global(.ui-button.search-button:active svg),
  :global(.ui-button.search-button.selected svg) {
    stroke-width: 2.4;
    color: var(--color-primary-500);
  }
</style>
