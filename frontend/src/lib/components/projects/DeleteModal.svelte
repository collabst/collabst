<script lang="ts">
  import Trash2 from "@lucide/svelte/icons/trash-2";

  let { show = $bindable(false), onConfirm } = $props<{
    show?: boolean;
    onConfirm: () => void;
  }>();

  // Handle Escape key
  $effect(() => {
    if (!show) return;
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  function closeModal() {
    show = false;
  }

  function handleConfirm() {
    onConfirm();
  }
</script>

{#if show}
  <div
    class="modal"
    onclick={closeModal}
    onkeydown={(e) => e.key === "Escape" && closeModal()}
    role="presentation"
  >
    <div
      class="modal-content"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      tabindex="-1"
    >
      <h2>Delete Project</h2>
      <p class="delete-message">
        Are you sure you want to delete this project?<br />This action cannot
        be undone and all files will be permanently deleted.
      </p>
      <div class="modal-actions">
        <button type="button" onclick={closeModal} class="cancel-btn">
          Cancel
        </button>
        <button type="button" onclick={handleConfirm} class="delete-btn">
          Delete Project
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--dialog-backdrop);
    backdrop-filter: blur(var(--dialog-backdrop-blur));
    -webkit-backdrop-filter: blur(var(--dialog-backdrop-blur));
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    z-index: var(--z-modal-backdrop);
    animation: fadeIn var(--transition-fast);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-content {
    background: var(--dialog-bg);
    border: 2px solid var(--dialog-border);
    padding: 2rem;
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 500px;
    box-shadow: var(--shadow-2xl);
    animation: slideUp var(--transition-base);
  }

  .modal-content h2 {
    font-size: 1.7rem;
    font-weight: var(--font-bold);
    margin: 0 0 1.5rem 0;
    color: var(--dialog-text);
  }

  .delete-message {
    color: var(--dialog-text);
    font-size: var(--text-lg);
    line-height: 1.5;
    margin: 0;
  }

  .modal-actions {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
    margin-top: 1.5rem;
  }

  .cancel-btn {
    flex: 1;
    background: var(--dialog-cancel-btn-bg);
    color: var(--dialog-text);
    border: none;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-size: var(--text-base);
  }

  .cancel-btn:hover {
    background: var(--dialog-cancel-btn-hover);
  }

  .cancel-btn:active {
    background: var(--dialog-cancel-btn-active);
    color: var(--text-active);
  }

  .delete-btn {
    flex: 1;
    background: var(--color-error);
    color: white;
    border: 1px solid var(--color-error);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-size: var(--text-base);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .delete-btn:hover {
    background: var(--color-error-dark);
    box-shadow: 0 1px 8px var(--color-error-glow);
  }

  .delete-btn:active {
    box-shadow: 0 1px 16px var(--color-error-glow);
  }
</style>
