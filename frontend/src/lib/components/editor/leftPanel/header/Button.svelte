<script lang="ts">
  import { type Snippet } from "svelte";

  interface Props {
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
  }

  let { children, onclick }: Props = $props();
</script>

<button class="button" {onclick}>
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
    color: var(--text-primary);
    border-radius: 5px;
  }

  .button :global(svg) {
    stroke-width: 2;
    width: 16px;
    height: 16px;
  }

  .button:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
    border-color: var(--border-secondary);
  }

  .button:hover :global(svg) {
    width: 16px;
    height: 16px;
  }

  .button:active {
    color: var(--text-active);
    /* transform: scaleX(1.15); */
  }

  .button:active :global(svg) {
    stroke-width: 3;
    width: 16px;
    height: 16px;
  }
</style>