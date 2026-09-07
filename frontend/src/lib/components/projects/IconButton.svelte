<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "../ui/Button.svelte";

  interface Props {
    children: Snippet;
    label: string;
    href?: string;
    onclick?: (e: MouseEvent) => void;
    tone?: "default" | "positive" | "danger";
    size?: number;
  }

  let {
    children,
    label,
    href,
    onclick,
    tone = "default",
    size = 17,
  }: Props = $props();
</script>

<Button
  class="projects-icon-button {tone}"
  {href}
  {onclick}
  title={label}
  ariaLabel={label}
  style="--icon-size: {size}px;"
>
  {@render children()}
</Button>

<style>
  :global(.ui-button.projects-icon-button) {
    padding: 0.35rem;
    border-radius: 0.5rem;
    color: var(--text-secondary);
    pointer-events: auto;
  }

  :global(.ui-button.projects-icon-button svg) {
    width: var(--icon-size);
    height: var(--icon-size);
  }

  :global(.ui-button.projects-icon-button:hover) {
    color: var(--text-primary);
    background-color: var(--surface-hover);
  }

  :global(.ui-button.projects-icon-button:hover svg) {
    animation: icon-jump 0.2s ease-out;
    stroke-width: 2.5;
  }

  :global(.ui-button.projects-icon-button:active svg) {
    transform: translateY(1px) scaleX(1.15) scaleY(0.95);
  }

  :global(.ui-button.projects-icon-button.positive:hover) {
    color: var(--color-success);
  }

  :global(.ui-button.projects-icon-button.danger:hover) {
    color: var(--color-error);
  }
</style>
