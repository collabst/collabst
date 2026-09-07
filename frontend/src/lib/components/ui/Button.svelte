<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
    href?: string;
    type?: "button" | "submit";
    disabled?: boolean;
    title?: string;
    ariaLabel?: string;
    class?: string;
    style?: string;
  }

  let {
    children,
    onclick,
    href,
    type = "button",
    disabled = false,
    title,
    ariaLabel,
    class: className = "",
    style,
  }: Props = $props();
</script>

<!--
  The behavioural base every button in the app is built on. It owns the element
  choice (`href` renders an `<a>`), the shared attributes, and the reset that all
  eight regional buttons used to repeat.

  It deliberately carries no visual style of its own: regional wrappers pass a
  distinctive class and style it with `:global(.ui-button.<their-class>)`, whose
  extra specificity means the wrapper always wins over the reset below.
-->
{#if href}
  <a class="ui-button {className}" {href} {title} aria-label={ariaLabel} {style}>
    {@render children()}
  </a>
{:else}
  <button
    class="ui-button {className}"
    {type}
    {onclick}
    {disabled}
    {title}
    aria-label={ariaLabel}
    {style}
  >
    {@render children()}
  </button>
{/if}

<style>
  :global(.ui-button) {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: 0;
    border: none;
    background: none;
    color: var(--text-primary);
    font: inherit;
    text-decoration: none;
    cursor: pointer;
  }

  :global(.ui-button:disabled) {
    cursor: default;
  }
</style>
