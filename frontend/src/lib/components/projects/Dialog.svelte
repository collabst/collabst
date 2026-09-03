<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    onclose: () => void;
    children: Snippet;
    actions?: Snippet;
    width?: string;
  }

  let { title, onclose, children, actions, width = "28rem" }: Props = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!--
  The dashboard's dialog shell: same floating rounded card as the editor's
  `files/DeleteConfirm.svelte`, factored out here because the dashboard opens
  several of them. Region-local on purpose — no app-wide modal primitive.
-->
<button class="backdrop" aria-label="Close dialog" onclick={onclose}></button>
<div
  class="dialog"
  role="dialog"
  aria-modal="true"
  aria-label={title}
  style="--dialog-width: {width};"
>
  <h2 class="title">{title}</h2>
  <div class="body">
    {@render children()}
  </div>
  {#if actions}
    <div class="actions">
      {@render actions()}
    </div>
  {/if}
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

  .dialog {
    position: fixed;
    z-index: 51;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(var(--dialog-width), calc(100vw - 2rem));
    max-height: calc(100vh - 4rem);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.5rem;
    border: 1px solid var(--navbar-border);
    border-radius: 1rem;
    background-color: var(--bg-primary);
    box-shadow:
      0 3px 0 0 var(--navbar-shadow),
      0 24px 48px -20px rgb(0 0 0 / 0.45);
  }

  .title {
    margin: 0;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }
</style>
