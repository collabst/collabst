<script lang="ts">
  import {
    cancelDeletion,
    confirmDeletion,
    pendingDeletion,
  } from "$lib/components/editor/context";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  let confirmButton: HTMLButtonElement | undefined = $state();

  $effect(() => {
    if ($pendingDeletion && confirmButton) confirmButton.focus();
  });

  function handleKeydown(event: KeyboardEvent) {
    if (!$pendingDeletion) return;
    if (event.key === "Escape") cancelDeletion();
  }

  let what = $derived(
    $pendingDeletion?.isFolder
      ? "folder"
      : $pendingDeletion?.kind === "asset"
        ? "file"
        : "document",
  );
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $pendingDeletion}
  <button class="backdrop" aria-label="Cancel" onclick={cancelDeletion}></button>
  <div class="dialog" role="alertdialog" aria-labelledby="delete-confirm-title">
    <div class="icon"><TriangleAlert size={20} /></div>
    <div class="title" id="delete-confirm-title">
      Delete {what} “{$pendingDeletion.name}”?
    </div>
    <div class="body">
      {#if $pendingDeletion.isFolder}
        Everything inside it goes too. This cannot be undone.
      {:else}
        This cannot be undone.
      {/if}
    </div>
    <div class="actions">
      <button class="button" onclick={cancelDeletion}>Cancel</button>
      <button
        bind:this={confirmButton}
        class="button danger"
        onclick={confirmDeletion}
      >
        Delete
      </button>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    border: none;
    cursor: default;
    background-color: rgb(0 0 0 / 0.25);
    backdrop-filter: blur(2px);
  }

  .dialog {
    position: fixed;
    z-index: 51;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(22rem, calc(100vw - 2rem));
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1.25rem;
    border-radius: 1rem;
    background-color: var(--bg-primary);
    border: 1px solid var(--navbar-border);
    box-shadow:
      0 3px 0 0 var(--navbar-shadow),
      0 24px 48px -20px rgb(0 0 0 / 0.45);
  }

  .icon {
    color: var(--color-error);
    display: flex;
  }

  .title {
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .body {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .button {
    padding: 0.4rem 0.9rem;
    border-radius: 0.6rem;
    border: 1px solid var(--navbar-border);
    background-color: var(--navbar-bg);
    color: var(--text-primary);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: inset 0 -3px 0 0 var(--navbar-shadow);
  }

  .button:hover {
    background-color: var(--surface-hover);
  }

  .button:active {
    box-shadow: inset 0 3px 0 0 var(--navbar-shadow);
    transform: translateY(1px);
  }

  .button.danger {
    color: var(--color-error);
    border-color: var(--color-error);
  }
</style>
