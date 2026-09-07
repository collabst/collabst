<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "../Button.svelte";

  interface Props {
    children: Snippet;
    onclick?: () => void;
    title?: string;
  }

  let { children, onclick, title }: Props = $props();
</script>

<Button class="top-button" {onclick} {title} ariaLabel={title}>
  {@render children()}
</Button>

<style>
  :global(.ui-button.top-button) {
    padding: 0.35rem;
  }

  :global(.ui-button.top-button svg) {
    stroke-width: 2;
    width: 20px;
    height: 20px;
  }

  :global(.ui-button.top-button:hover svg) {
    animation: icon-jump 0.2s ease-out;
    stroke-width: 2.5;
  }

  :global(.ui-button.top-button:active svg) {
    transform: translateY(1px) scaleX(1.15) scaleY(0.95);
  }
</style>
