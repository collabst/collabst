<script lang="ts">
  import type { Snippet } from 'svelte'
  import X from '@lucide/svelte/icons/x'
  import IconButton from './IconButton.svelte'
  
  interface ModalProps {
    open?: boolean
    title?: string
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
    onClose?: () => void
    children?: Snippet
    footer?: Snippet
  }
  
  let {
    open = $bindable(false),
    title = '',
    size = 'md',
    onClose,
    children,
    footer
  }: ModalProps = $props()
  
  function handleClose() {
    open = false
    onClose?.()
  }
  
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose()
    }
  }
</script>

{#if open}
  <div 
    class="modal-backdrop" 
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="presentation"
  >
    <div class="modal modal-{size}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        {#if title}
          <h2 id="modal-title" class="modal-title">{title}</h2>
        {/if}
        <IconButton 
          icon={X} 
          onclick={handleClose}
          title="Close"
          class="modal-close"
        />
      </div>
      
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
    background: var(--bg-overlay);
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
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2xl);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    width: 100%;
    animation: slideUp var(--transition-base);
    border: 1px solid var(--border-primary);
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
    border-bottom: 1px solid var(--border-primary);
  }
  
  .modal-title {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0;
  }
  
  .modal-body {
    padding: var(--space-6);
    overflow-y: auto;
    flex: 1;
  }
  
  .modal-footer {
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--border-primary);
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
  }
  
  :global(.modal-close) {
    margin-left: auto;
  }
</style>
