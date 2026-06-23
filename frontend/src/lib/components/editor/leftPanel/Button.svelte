<script lang="ts">
  import { type Snippet } from "svelte";

  interface Props {
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
    selected?: boolean;
  }

  let { children, onclick, selected = false }: Props = $props();
</script>

<button class="button" class:selected {onclick}>
  {@render children()}
</button>

<style>
  .button {
    background: none;
    border: none;
    padding: 0.4rem 0.4rem 0.5rem 0.4rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
    border-radius: 7px;
    border: 1px transparent solid;
  }

  .button :global(svg) {
    stroke-width: 2;
    width: 18px;
    height: 18px;
  }

  .button:hover {
    background: var(--navbar-bg);
    color: var(--text-primary);
    border-color: var(--navbar-border);

    box-shadow: inset 0px -3px 0px 0px var(--navbar-shadow);
    transform: translateY(-1px);
  }

  .button:active,
  .button.selected {
    background: var(--navbar-bg);
    color: var(--text-active);
    border-color: var(--navbar-border);
    border-bottom-width: 1px;
    box-shadow: inset 0px 3px 0px 0px var(--navbar-shadow);
    transform: translateY(-1px);
  }

  .button:active :global(svg),
  .button.selected :global(svg) {
    transform: translateY(2px) scaleY(0.9) scaleX(1.1);
  }
</style>
