<script lang="ts">
  import { type Snippet } from "svelte";

  interface Props {
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
    selected?: boolean;
    class?: string;
  }

  let { children, onclick, selected = false, class: className = "" }: Props = $props();
</script>

<button class="button {className}" class:selected {onclick}>
  {@render children()}
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
    color: var(--text-secondary);
    border-radius: 5px;
  }

  .button :global(svg) {
    stroke-width: 2;
    width: 16px;
    height: 16px;
  }

  .button:hover {
    color: var(--text-active);
  }

  .button:hover :global(svg) {
    stroke-width: 2.4;
    transform: scale(1.05);
  }

  .button:active :global(svg) {
    transform: scaleY(0.9) scaleX(1.2);
  }

  .button:active :global(svg),
  .button.selected :global(svg) {
    stroke-width: 2.4;
    color: var(--color-primary-500);
  }
</style>
