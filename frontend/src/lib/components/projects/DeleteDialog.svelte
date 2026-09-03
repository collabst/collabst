<script lang="ts">
  import {
    cancelDeletion,
    confirmDeletion,
    deletingProject,
    pendingDeletion,
  } from "./context";
  import Dialog from "./Dialog.svelte";
  import Button from "./Button.svelte";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  // `Button` renders the element, so the focus target is looked up through the
  // wrapper rather than bound directly.
  let confirmWrapper: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!$pendingDeletion) return;
    queueMicrotask(() => confirmWrapper?.querySelector("button")?.focus());
  });
</script>

{#if $pendingDeletion}
  <Dialog title="Delete project" onclose={cancelDeletion}>
    <p class="body">
      Delete <strong>{$pendingDeletion.name}</strong>? Every file in it is
      permanently removed. This cannot be undone.
    </p>

    {#snippet actions()}
      <Button onclick={cancelDeletion}>Cancel</Button>
      <div bind:this={confirmWrapper}>
        <Button
          variant="danger"
          disabled={$deletingProject}
          onclick={() => void confirmDeletion()}
        >
          <Trash2 size={16} />
          {$deletingProject ? "Deleting…" : "Delete project"}
        </Button>
      </div>
    {/snippet}
  </Dialog>
{/if}

<style>
  .body {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--text-secondary);
  }

  strong {
    color: var(--text-primary);
  }
</style>
