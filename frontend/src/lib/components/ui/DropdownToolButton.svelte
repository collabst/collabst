<script lang="ts">
  import type { Component } from 'svelte'
  
  interface DropdownItem {
    label: string
    icon?: Component
    onclick: () => void
    separator?: boolean  // Show separator AFTER this item
  }

  interface DropdownToolButtonProps {
    icon?: Component | string  // Can be Component or text like "50%"
    items: DropdownItem[]
    disabled?: boolean
    active?: boolean
    class?: string
    position?: 'standalone' | 'first' | 'middle' | 'last'
    strokeWidth?: number
    buttonWidth?: string  // Custom button width
    buttonBackground?: string  // Custom button background color
    allowIconOverflow?: boolean  // Allow icon to overflow button boundaries
  }
  
  let {
    icon,
    items,
    disabled = false,
    active = false,
    class: className = '',
    position = 'standalone',
    strokeWidth = 2,
    buttonWidth = '30px',
    buttonBackground = undefined,
    allowIconOverflow = true
  }: DropdownToolButtonProps = $props()

  let isOpen = $state(false)
  let buttonRef: HTMLButtonElement | undefined = $state()
  
  const iconIsComponent = $derived(typeof icon !== 'string' && icon !== undefined)
  const iconIsText = $derived(typeof icon === 'string')
  const Icon = $derived(iconIsComponent ? icon as Component : null);
  
  function toggleDropdown() {
    isOpen = !isOpen
  }
  
  function closeDropdown() {
    isOpen = false
  }
  
  function handleItemClick(item: DropdownItem) {
    item.onclick()
    closeDropdown()
  }
  
  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (buttonRef && !buttonRef.contains(event.target as Node)) {
      closeDropdown()
    }
  }
  
  $effect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => {
        document.removeEventListener('click', handleClickOutside)
      }
    }
  })
</script>

<div class="dropdown-container">
  <button
    bind:this={buttonRef}
    type="button"
    {disabled}
    class="tool-btn tool-btn-{position} {active ? 'tool-btn-active' : ''} {allowIconOverflow ? '' : 'no-icon-overflow'} {className}"
    onclick={toggleDropdown}
    style="{buttonBackground ? `background: ${buttonBackground};` : ''} {buttonWidth ? `width: ${buttonWidth};` : ''}"
  >
    {#if iconIsComponent && Icon}
      <Icon size={16} strokeWidth={strokeWidth} />
    {:else if iconIsText}
      <span class="button-text">{icon}</span>
    {/if}
  </button>
  
  {#if isOpen}
    <div 
      class="dropdown-menu"
      role="menu"
      tabindex="-1"
    >
      {#each items as item, index}
        <button
          type="button"
          class="dropdown-item"
          onclick={() => handleItemClick(item)}
        >
          {#if item.icon}
            {@const ItemIcon = item.icon}
            <span class="dropdown-item-icon">
              <ItemIcon size={14} strokeWidth={2} />
            </span>
          {/if}
          <span class="dropdown-item-label">{item.label}</span>
        </button>
        {#if item.separator}
          <div class="dropdown-separator"></div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .dropdown-container {
    position: relative;
    display: inline-block;
  }

  .tool-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    background: var(--bg-editor);
    border: 1px solid var(--border-primary);
    color: var(--text-secondary);
    cursor: pointer;
    user-select: none;
    height: 30px;
    overflow: visible;
  }
  
  .tool-btn :global(svg) {
    transform: scale(1.8);
  }

  .tool-btn.no-icon-overflow {
    overflow: hidden;
  }

  .tool-btn.no-icon-overflow :global(svg) {
    transform: scale(1);
  }
  
  .tool-btn:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text-primary);
    border-color: var(--border-secondary);
  }
  
  .tool-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .tool-btn-active {
    background: var(--surface-hover);
    color: var(--text-primary);
    border-color: var(--border-secondary);
  }
  
  /* Position variants - handle border radius and margins */
  .tool-btn-standalone {
    border-radius: var(--radius-md);
  }
  
  .tool-btn-first {
    border-top-left-radius: var(--radius-md);
    border-bottom-left-radius: var(--radius-md);
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    border-right: none;
  }
  
  .tool-btn-middle {
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
  
  .tool-btn-last {
    border-top-right-radius: var(--radius-md);
    border-bottom-right-radius: var(--radius-md);
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-left: none;
  }
  
  /* Dropdown menu */
  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--bg-editor);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    overflow: hidden;
    padding: 4px 0;
    width: max-content;
    min-width: 140px;
  }
  
  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    font-size: 13px;
  }
  
  .dropdown-item:hover {
    background: var(--surface-hover);
  }
  
  .dropdown-item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
  }
  
  .dropdown-item-label {
    flex: 1;
  }
  
  .dropdown-separator {
    height: 1px;
    background: var(--border-primary);
    margin: 4px 0;
  }
  
  .button-text {
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }
</style>
