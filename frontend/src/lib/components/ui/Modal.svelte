<script lang="ts">
  import type { Snippet } from "svelte";
  import X from "@lucide/svelte/icons/x";
  import IconButton from "./IconButton.svelte";

  interface ModalProps {
    open?: boolean;
    title?: string;
    size?: "sm" | "md" | "lg" | "xl" | "full";
    hideCloseButton?: boolean;
    onClose?: () => void;
    children?: Snippet;
    footer?: Snippet;
  }

  let {
    open = $bindable(false),
    title = "",
    size = "md",
    hideCloseButton = false,
    onClose,
    children,
    footer,
  }: ModalProps = $props();

  // Handle Escape key with window-level event listener
  $effect(() => {
    if (!open) return;

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  function handleClose() {
    open = false;
    onClose?.();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }
</script>

{#if open}
  <div class="modal-backdrop" onclick={handleBackdropClick} role="presentation">
    <div
      class="modal modal-{size}"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {#if title || !hideCloseButton}
        <div class="modal-header">
          {#if title}
            <h2 id="modal-title" class="modal-title">{title}</h2>
          {/if}
          {#if !hideCloseButton}
            <IconButton
              icon={X}
              onclick={handleClose}
              title="Close"
              class="modal-close"
            />
          {/if}
        </div>
      {/if}

      <div class="modal-body">
        {@render children?.()}
      </div>

      {#if footer}
        <div class="modal-footer">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--dialog-backdrop);
    backdrop-filter: blur(var(--dialog-backdrop-blur));
    -webkit-backdrop-filter: blur(var(--dialog-backdrop-blur));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal-backdrop);
    padding: var(--space-4);
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

  .modal {
    background: var(--dialog-bg);
    border: 2px solid var(--dialog-border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-2xl);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    width: 100%;
    animation: slideUp var(--transition-base);
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

  .modal-sm {
    max-width: 400px;
  }

  .modal-md {
    max-width: 600px;
  }

  .modal-lg {
    max-width: 800px;
  }

  .modal-xl {
    max-width: 1200px;
  }

  .modal-full {
    max-width: 95vw;
    max-height: 95vh;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-6);
  }

  .modal-title {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--dialog-text);
    margin: 0;
  }

  .modal-body {
    padding: var(--space-6);
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    padding: var(--space-4) var(--space-6);
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
  }

  :global(.modal-close) {
    margin-left: auto;
  }
</style>
