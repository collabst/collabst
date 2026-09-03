<script lang="ts">
  import type { Snippet } from "svelte";

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
{#if href}
  <a class="button {variant}" class:selected {href} {title} aria-label={ariaLabel}>
    {@render children()}
  </a>
{:else}
  <button
    class="button {variant}"
    class:selected
    {type}
    {onclick}
    {disabled}
    {title}
    aria-label={ariaLabel}
  >
    {@render children()}
  </button>
{/if}

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.5rem 0.85rem;
    border: 1px solid var(--navbar-border);
    border-radius: 0.7rem;
    background-color: var(--navbar-bg);
    box-shadow: inset 0 -3px 0 0 var(--navbar-shadow);
    color: var(--text-primary);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }

  .button :global(svg) {
    flex-shrink: 0;
  }

  .button:hover:not(:disabled) {
    color: var(--text-active);
    transform: translateY(-1px);
  }

  .button:active:not(:disabled),
  .button.selected {
    color: var(--text-active);
    box-shadow: inset 0 3px 0 0 var(--navbar-shadow);
    transform: translateY(1px);
  }

  .button.primary {
    border-color: var(--color-tertiary-500);
    color: var(--color-tertiary-500);
  }

  .button.primary:hover:not(:disabled) {
    box-shadow:
      inset 0 -3px 0 0 var(--navbar-shadow),
      0 0 12px -2px var(--color-tertiary-glow);
  }

  .button.danger {
    border-color: var(--color-error);
    color: var(--color-error);
  }

  .button.danger:hover:not(:disabled) {
    box-shadow:
      inset 0 -3px 0 0 var(--navbar-shadow),
      0 0 12px -2px var(--color-error-glow);
  }

  .button:disabled {
    cursor: default;
    opacity: 0.45;
    transform: none;
  }
</style>
