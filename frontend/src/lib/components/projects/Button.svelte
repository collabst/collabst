<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "../ui/Button.svelte";

  interface Props {
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
    href?: string;
    type?: "button" | "submit";
    variant?: "default" | "primary" | "danger";
    selected?: boolean;
    disabled?: boolean;
    title?: string;
    ariaLabel?: string;
  }

  let {
    children,
    onclick,
    href,
    type = "button",
    variant = "default",
    selected = false,
    disabled = false,
    title,
    ariaLabel,
  }: Props = $props();
</script>

<!--
  The dashboard's button, in the same physical-press vocabulary as the editor's
  (`leftPanel/Button.svelte`): a bordered pill with an inset shadow that flips
  from the bottom edge to the top edge when pressed.
-->
<Button
  class="projects-button {variant} {selected ? 'selected' : ''}"
  {onclick}
  {href}
  {type}
  {disabled}
  {title}
  {ariaLabel}
>
  {@render children()}
</Button>

<style>
  :global(.ui-button.projects-button) {
    display: inline-flex;
    gap: 0.4rem;
    padding: 0.5rem 0.85rem;
    border: 1px solid var(--navbar-border);
    border-radius: 0.7rem;
    background-color: var(--navbar-bg);
    box-shadow: inset 0 -3px 0 0 var(--navbar-shadow);
    font-size: 0.875rem;
    font-weight: 600;
  }

  :global(.ui-button.projects-button svg) {
    flex-shrink: 0;
  }

  :global(.ui-button.projects-button:hover:not(:disabled)) {
    color: var(--text-active);
    transform: translateY(-1px);
  }

  :global(.ui-button.projects-button:active:not(:disabled)),
  :global(.ui-button.projects-button.selected) {
    color: var(--text-active);
    box-shadow: inset 0 3px 0 0 var(--navbar-shadow);
    transform: translateY(1px);
  }

  :global(.ui-button.projects-button.primary) {
    border-color: var(--color-tertiary-500);
    color: var(--color-tertiary-500);
  }

  :global(.ui-button.projects-button.primary:hover:not(:disabled)) {
    box-shadow:
      inset 0 -3px 0 0 var(--navbar-shadow),
      0 0 12px -2px var(--color-tertiary-glow);
  }

  :global(.ui-button.projects-button.danger) {
    border-color: var(--color-error);
    color: var(--color-error);
  }

  :global(.ui-button.projects-button.danger:hover:not(:disabled)) {
    box-shadow:
      inset 0 -3px 0 0 var(--navbar-shadow),
      0 0 12px -2px var(--color-error-glow);
  }

  :global(.ui-button.projects-button:disabled) {
    opacity: 0.45;
    transform: none;
  }
</style>
