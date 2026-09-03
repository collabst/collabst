<script lang="ts">
  import type { Component } from "svelte";

  interface Props {
    icon: Component;
    label: string;
    href?: string;
    onclick?: (e: MouseEvent) => void;
    tone?: "default" | "positive" | "danger";
    size?: number;
  }

  let {
    icon: Icon,
    label,
    href,
    onclick,
    tone = "default",
    size = 17,
  }: Props = $props();
</script>

{#if href}
  <a class="icon-button {tone}" {href} title={label} aria-label={label}>
    <Icon {size} />
  </a>
{:else}
  <button class="icon-button {tone}" {onclick} title={label} aria-label={label}>
    <Icon {size} />
  </button>
{/if}

<style>
  .icon-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.35rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    text-decoration: none;
    pointer-events: auto;
  }

  .icon-button:hover {
    color: var(--text-primary);
    background-color: var(--surface-hover);
  }

  .icon-button:hover :global(svg) {
    animation: jumpAnimation 0.2s ease-out;
    stroke-width: 2.5;
  }

  @keyframes jumpAnimation {
    0% {
      transform: translateY(-3px) scaleX(0.8) scaleY(1.2);
    }
    80% {
      transform: translateY(1px) scaleX(1.2) scaleY(0.95);
    }
    100% {
      transform: none;
    }
  }

  .icon-button:active :global(svg) {
    transform: translateY(1px) scaleX(1.15) scaleY(0.95);
  }

  .icon-button.positive:hover {
    color: var(--color-success);
  }

  .icon-button.danger:hover {
    color: var(--color-error);
  }
</style>
