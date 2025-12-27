<script lang="ts">
  import type { Snippet } from 'svelte'
  
  interface InputProps {
    type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'search'
    value?: string
    placeholder?: string
    disabled?: boolean
    required?: boolean
    fullWidth?: boolean
    error?: string
    label?: string
    class?: string
    autofocus?: boolean
    inputElement?: HTMLInputElement
    oninput?: (e: Event) => void
    onchange?: (e: Event) => void
  }
  
  let {
    type = 'text',
    value = $bindable(''),
    placeholder = '',
    disabled = false,
    required = false,
    fullWidth = false,
    error = '',
    label = '',
    class: className = '',
    autofocus = false,
    inputElement = $bindable(undefined),
    oninput,
    onchange
  }: InputProps = $props()
</script>

<div class="input-wrapper {fullWidth ? 'input-full' : ''} {className}">
  {#if label}
    <label class="input-label">
      {label}
      {#if required}<span class="required">*</span>{/if}
    </label>
  {/if}
  
  <input
    bind:this={inputElement}
    {type}
    bind:value
    {placeholder}
    {disabled}
    {required}
    autofocus={autofocus}
    class="input {error ? 'input-error' : ''}"
    {oninput}
    {onchange}
  />
  
  {#if error}
    <span class="error-message">{error}</span>
  {/if}
</div>

<style>
  .input-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  
  .input-full {
    width: 100%;
  }
  
  .input-label {
    font-size: var(--text-md);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
  }
  
  .required {
    color: var(--color-error);
    margin-left: 2px;
  }
  
  .input {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-base);
    font-family: var(--font-sans);
    background: var(--surface-primary);
    border: 2px solid var(--border-primary);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    width: 100%;
  }
  
  .input:focus {
    outline: none;
    border-color: var(--color-primary-500);
    /* box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); */
  }
  
  .input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--surface-tertiary);
  }
  
  .input-error {
    border-color: var(--border-error);
  }
  
  .input-error:focus {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }
  
  .error-message {
    font-size: var(--text-sm);
    color: var(--color-error);
  }
</style>
