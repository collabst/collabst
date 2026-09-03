<script lang="ts">
  import type { Snippet } from "svelte";
  import X from "@lucide/svelte/icons/x";

  interface Props {
    title: string;
    onclose: () => void;
    children: Snippet;
    width?: string;
  }

  let { title, onclose, children, width = "26rem" }: Props = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!--
  The settings surface: a floating rounded card in the same vocabulary as the
  editor's context menu, local to this region rather than a shared modal.
-->
<button class="backdrop" aria-label="Close settings" onclick={onclose}></button>
<div
  class="panel"
  role="dialog"
  aria-modal="true"
  aria-label={title}
  style="--panel-width: {width};"
>
  <header class="header">
    <h2>{title}</h2>
    <button class="close" onclick={onclose} aria-label="Close settings">
      <X size={17} />
    </button>
  </header>
  <div class="content">
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    border: none;
    cursor: default;
    background-color: var(--dialog-backdrop);
    backdrop-filter: blur(var(--dialog-backdrop-blur));
  }

  .panel {
    position: fixed;
    z-index: 51;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(var(--panel-width), calc(100vw - 2rem));
    max-height: calc(100vh - 4rem);
    display: flex;
    flex-direction: column;
    border: 1px solid var(--navbar-border);
    border-radius: 1rem;
    background-color: var(--bg-primary);
    box-shadow:
      0 3px 0 0 var(--navbar-shadow),
      0 24px 48px -20px rgb(0 0 0 / 0.45);
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.25rem 0.5rem 1.25rem;
  }

  h2 {
    flex: 1;
    margin: 0;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 1.6rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .close {
    display: flex;
    padding: 0.3rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
  }

  .close:hover {
    background-color: var(--surface-hover);
    color: var(--text-primary);
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem 1.25rem 1.25rem 1.25rem;
    overflow-y: auto;
  }
</style>
