<script lang="ts">
  import type { Snippet } from 'svelte'
  
  type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  type ButtonSize = 'sm' | 'md' | 'lg'
  
  interface ButtonProps {
    variant?: ButtonVariant
    size?: ButtonSize
    disabled?: boolean
    fullWidth?: boolean
    type?: 'button' | 'submit' | 'reset'
    onclick?: () => void
    class?: string
    children?: Snippet
  }
  
  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    fullWidth = false,
    type = 'button',
    onclick,
    class: className = '',
    children
  }: ButtonProps = $props()
</script>

<button
  {type}
  {disabled}
  class="btn btn-{variant} btn-{size} {fullWidth ? 'btn-full' : ''} {className}"
  onclick={onclick}
>
  {@render children?.()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font-family: var(--font-sans);
    font-weight: var(--font-medium);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
    user-select: none;
  }
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Sizes */
  .btn-sm {
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-sm);
    height: 32px;
  }
  
  .btn-md {
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-base);
    height: 40px;
  }
  
  .btn-lg {
    padding: var(--space-3) var(--space-6);
    font-size: var(--text-lg);
    height: 48px;
  }
  
  /* Variants */
  .btn-primary {
    background: var(--color-primary-600);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-700);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  .btn-primary:active:not(:disabled) {
    background: var(--color-primary-800);
    transform: translateY(0);
  }
  
  .btn-secondary {
    background: var(--color-secondary-600);
    color: white;
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: var(--color-secondary-700);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-primary);
  }
  
  .btn-ghost:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text-primary);
    border-color: var(--border-secondary);
  }
  
  .btn-danger {
    background: var(--color-error);
    color: white;
  }
  
  .btn-danger:hover:not(:disabled) {
    background: var(--color-error-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  .btn-success {
    background: var(--color-success);
    color: white;
  }
  
  .btn-success:hover:not(:disabled) {
    background: var(--color-success-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  .btn-full {
    width: 100%;
  }
</style>
