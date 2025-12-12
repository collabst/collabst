<script lang="ts">
  import type { ComponentType } from 'svelte'
  import Icon from './Icon.svelte'
  
  type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  type ButtonSize = 'sm' | 'md' | 'lg'
  
  interface IconButtonProps {
    icon: ComponentType
    variant?: ButtonVariant
    size?: ButtonSize
    disabled?: boolean
    title?: string
    onclick?: () => void
    class?: string
    ariaLabel?: string
  }
  
  let {
    icon,
    variant = 'ghost',
    size = 'md',
    disabled = false,
    title = '',
    onclick,
    class: className = '',
    ariaLabel = title
  }: IconButtonProps = $props()
  
  const iconSizeMap = {
    sm: 16,
    md: 20,
    lg: 24
  }
</script>

<button
  type="button"
  {disabled}
  {title}
  aria-label={ariaLabel}
  class="icon-btn icon-btn-{variant} icon-btn-{size} {className}"
  onclick={onclick}
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
    transition: all var(--transition-fast);
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
  
  /* Variants */
  .icon-btn-primary {
    background: var(--color-primary-600);
    color: white;
  }
  
  .icon-btn-primary:hover:not(:disabled) {
    background: var(--color-primary-700);
    transform: scale(1.05);
  }
  
  .icon-btn-secondary {
    background: var(--color-secondary-600);
    color: white;
  }
  
  .icon-btn-secondary:hover:not(:disabled) {
    background: var(--color-secondary-700);
    transform: scale(1.05);
  }
  
  .icon-btn-ghost {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-primary);
  }
  
  .icon-btn-ghost:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text-primary);
    border-color: var(--border-secondary);
    transform: scale(1.05);
  }
  
  .icon-btn-danger {
    background: var(--color-error);
    color: white;
  }
  
  .icon-btn-danger:hover:not(:disabled) {
    background: var(--color-error-dark);
    transform: scale(1.05);
  }
  
  .icon-btn-success {
    background: var(--color-success);
    color: white;
  }
  
  .icon-btn-success:hover:not(:disabled) {
    background: var(--color-success-dark);
    transform: scale(1.05);
  }
</style>
