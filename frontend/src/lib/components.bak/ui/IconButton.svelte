<script lang="ts">
  import type { Component } from "svelte";
  import Icon from "./Icon.svelte";

  type ButtonVariant =
    | "primary"
    | "secondary"
    | "ghost"
    | "danger"
    | "success"
    | "flat"
    | "top-bar"
    | "replace-all";
  type ButtonSize = "sm" | "md" | "lg" | "top-bar" | "find-toggle";

  interface IconButtonProps {
    icon: Component;
    variant?: ButtonVariant;
    size?: ButtonSize;
    disabled?: boolean;
    title?: string;
    onclick?: () => void;
    class?: string;
    ariaLabel?: string;
    selected?: boolean;
  }

  let {
    icon,
    variant = "ghost",
    size = "md",
    disabled = false,
    title = "",
    onclick,
    class: className = "",
    ariaLabel = title,
    selected = false,
  }: IconButtonProps = $props();

  const iconSizeMap = {
    sm: 16,
    md: 20,
    lg: 24,
    "top-bar": 18,
    "find-toggle": 16,
    "replace-all": 10,
  };
</script>

<button
  type="button"
  {disabled}
  {title}
  aria-label={ariaLabel}
  class="icon-btn icon-btn-{variant} icon-btn-{size} icon-btn-{selected
    ? 'selected'
    : 'not-selected'} {className}"
  {onclick}
>
  <Icon {icon} size={iconSizeMap[size]} />
</button>

<style>
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    flex-shrink: 0;
  }

  .icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Sizes */
  .icon-btn-sm {
    width: 32px;
    height: 32px;
  }

  .icon-btn-md {
    width: 40px;
    height: 40px;
  }

  .icon-btn-lg {
    width: 48px;
    height: 48px;
  }

  .icon-btn-top-bar {
    width: 30px;
    height: 30px;
  }

  .icon-btn-find-toggle {
    width: 26px;
    height: 26px;
    background: none !important;
  }

  .icon-btn-find-toggle:hover:not(:disabled) {
    background: none !important;
  }

  .icon-btn-find-toggle:active:not(:disabled) {
    background: none !important;
    transform: scaleY(0.8) scaleX(1.15);
  }

  .icon-btn-replace-all {
    width: 24px;
    height: 24px;
    background: none !important;
    padding: 1px;
    color: var(--text-secondary);
  }

  .icon-btn-replace-all:hover:not(:disabled) {
    background: var(--surface-hover) !important;
    color: var(--color-error);
  }

  .icon-btn-replace-all:active:not(:disabled) {
    background: var(--surface-active) !important;
    color: var(--color-error-dark);
    transform: scaleY(0.9) scaleX(1.15);
  }

  /* Variants */
  .icon-btn-primary {
    background: var(--color-primary-600);
    color: white;
  }

  .icon-btn-primary:hover:not(:disabled) {
    background: var(--color-primary-700);
  }

  .icon-btn-secondary {
    background: var(--color-secondary-600);
    color: white;
  }

  .icon-btn-secondary:hover:not(:disabled) {
    background: var(--color-secondary-700);
  }

  .icon-btn-ghost {
    background: var(--bg-top-bar);
    color: var(--text-secondary);
    border: 1px solid var(--border-primary);
  }

  .icon-btn-ghost:hover:not(:disabled) {
    background: var(--bg-editor);
    color: var(--color-primary-500);
    border-color: var(--border-secondary);
    border-bottom: 3px solid var(--border-secondary);
  }

  .icon-btn-ghost:active:not(:disabled) {
    background: var(--surface-hover);
    border: 1px solid var(--surface-active);
  }
  .icon-btn-ghost:active:not(:disabled) :global(svg) {
    transform: scaleY(0.95) scaleX(1.05);
  }

  .icon-btn-danger {
    background: var(--color-error);
    color: white;
  }

  .icon-btn-danger:hover:not(:disabled) {
    background: var(--color-error-dark);
  }

  .icon-btn-success {
    background: var(--color-success);
    color: white;
  }

  .icon-btn-success:hover:not(:disabled) {
    background: var(--color-success-dark);
  }

  .icon-btn-flat {
    background: transparent;
    color: var(--text-secondary);
  }

  .icon-btn-flat:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .icon-btn-flat:active:not(:disabled) {
    background: var(--surface-active);
    color: var(--text-primary);
  }

  .icon-btn-top-bar {
    background: transparent;
    color: var(--text-secondary);
    border-radius: 20px;
  }

  .icon-btn-top-bar:hover:not(:disabled) {
    color: var(--text-primary);
  }
  .icon-btn-top-bar:hover:not(:disabled) :global(svg) {
    animation: jumpAnimation 0.2s ease-out;
    stroke-width: 2.5;
  }

  @keyframes jumpAnimation {
    0% {
      transform: translateY(-2px) scaleX(0.8) scaleY(1.1);
    }
    80% {
      transform: translateY(1px) scaleX(1.1) scaleY(0.95);
    }
    100% {
      transform: none;
    }
  }

  .icon-btn-top-bar:active:not(:disabled) {
    color: var(--text-active);
  }

  .icon-btn-top-bar:active:not(:disabled) :global(svg) {
    transform: scaleY(0.9) scaleX(1.1);
  }

  .icon-btn-selected {
    color: var(--color-primary-500);
  }

  .icon-btn-selected:hover:not(:disabled) {
    color: var(--color-primary-500);
  }

  .icon-btn-selected:active:not(:disabled) {
    color: var(--color-primary-500);
  }
</style>
