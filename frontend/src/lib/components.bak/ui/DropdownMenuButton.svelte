<script lang="ts" module>
  import type { Component } from "svelte";

  export interface DropdownMenuItem {
    label: string;
    icon?: Component;
    onclick?: () => void;
    separator?: boolean; // Show separator AFTER this item
    submenu?: DropdownMenuItem[]; // For nested menus
    shortcut?: string; // Keyboard shortcut display
    checked?: boolean; // For toggle items
    isToggle?: boolean; // Whether this is a toggle item (doesn't close menu)
    disabled?: boolean; // Whether this item is disabled
  }
</script>

<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Check from "@lucide/svelte/icons/check";

  interface DropdownMenuButtonProps {
    label: string;
    items: DropdownMenuItem[];
    disabled?: boolean;
    isOpen?: boolean;
    onToggle?: (open: boolean) => void;
    onHover?: () => void;
  }

  let {
    label,
    items,
    disabled = false,
    isOpen: externalIsOpen = $bindable(false),
    onToggle,
    onHover,
  }: DropdownMenuButtonProps = $props();

  let buttonRef: HTMLButtonElement | undefined = $state();
  let openSubmenu: number | null = $state(null);
  let submenuTimeoutId: number | null = null;

  // Sync external and internal state
  $effect(() => {
    if (externalIsOpen === false) {
      openSubmenu = null;
    }
  });

  function toggleDropdown() {
    if (disabled) return;
    const newState = !externalIsOpen;
    externalIsOpen = newState;
    if (onToggle) onToggle(newState);
    if (!newState) {
      openSubmenu = null;
    }
  }

  function closeDropdown() {
    externalIsOpen = false;
    if (onToggle) onToggle(false);
    openSubmenu = null;
  }

  function handleMouseEnter() {
    if (onHover) onHover();
  }

  function handleItemClick(item: DropdownMenuItem) {
    if (item.submenu) return; // Don't close for submenu items
    if (item.onclick) {
      item.onclick();
    }
    // Don't close if it's a toggle item
    if (!item.isToggle) {
      closeDropdown();
    }
  }

  function handleSubmenuEnter(index: number) {
    if (submenuTimeoutId) {
      clearTimeout(submenuTimeoutId);
      submenuTimeoutId = null;
    }
    openSubmenu = index;
  }

  function handleSubmenuLeave() {
    submenuTimeoutId = window.setTimeout(() => {
      openSubmenu = null;
    }, 300);
  }

  function handleSubmenuItemClick(item: DropdownMenuItem) {
    if (item.onclick) {
      item.onclick();
    }
    // Don't close if it's a toggle item
    if (!item.isToggle) {
      closeDropdown();
    }
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (buttonRef && !buttonRef.contains(event.target as Node)) {
      // Check if click is not in any dropdown menu
      const target = event.target as HTMLElement;
      if (!target.closest(".dropdown-menu")) {
        closeDropdown();
      }
    }
  }

  $effect(() => {
    if (externalIsOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }
  });
</script>

<div class="dropdown-menu-button">
  <button
    bind:this={buttonRef}
    type="button"
    {disabled}
    class="menu-button"
    class:active={externalIsOpen}
    onclick={toggleDropdown}
    onmouseenter={handleMouseEnter}
  >
    <span class="menu-button-label">{label}</span>
  </button>

  {#if externalIsOpen}
    <div class="dropdown-menu" role="menu" tabindex="-1">
      {#each items as item, index}
        <div
          class="dropdown-item-container"
          role="presentation"
          onmouseenter={() => item.submenu && handleSubmenuEnter(index)}
          onmouseleave={() => item.submenu && handleSubmenuLeave()}
        >
          <button
            type="button"
            class="dropdown-item"
            class:has-submenu={!!item.submenu}
            class:disabled={item.disabled}
            disabled={item.disabled}
            onclick={() => handleItemClick(item)}
          >
            {#if item.icon}
              {@const Icon = item.icon}
              <span class="dropdown-item-icon">
                <Icon size={14} strokeWidth={2} />
              </span>
            {/if}
            <span class="dropdown-item-label">{item.label}</span>
            {#if item.checked}
              <span class="dropdown-item-check">
                <Check size={14} strokeWidth={2} />
              </span>
            {/if}
            {#if item.shortcut}
              <span class="dropdown-item-shortcut">{item.shortcut}</span>
            {/if}
            {#if item.submenu}
              <span class="dropdown-item-arrow">
                <ChevronRight size={14} strokeWidth={2} />
              </span>
            {/if}
          </button>

          {#if item.submenu && openSubmenu === index}
            <div
              class="dropdown-submenu"
              role="menu"
              tabindex="-1"
              onmouseenter={() =>
                submenuTimeoutId && clearTimeout(submenuTimeoutId)}
              onmouseleave={handleSubmenuLeave}
            >
              {#each item.submenu as subItem}
                <button
                  type="button"
                  class="dropdown-item"
                  onclick={() => handleSubmenuItemClick(subItem)}
                >
                  {#if subItem.icon}
                    {@const SubIcon = subItem.icon}
                    <span class="dropdown-item-icon">
                      <SubIcon size={14} strokeWidth={2} />
                    </span>
                  {/if}
                  <span class="dropdown-item-label">{subItem.label}</span>
                  {#if subItem.checked}
                    <span class="dropdown-item-check">
                      <Check size={14} strokeWidth={2} />
                    </span>
                  {/if}
                  {#if subItem.shortcut}
                    <span class="dropdown-item-shortcut"
                      >{subItem.shortcut}</span
                    >
                  {/if}
                </button>
                {#if subItem.separator}
                  <div class="dropdown-separator"></div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>

        {#if item.separator}
          <div class="dropdown-separator"></div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .dropdown-menu-button {
    position: relative;
    display: inline-block;
  }

  .menu-button {
    padding: 4px 10px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-primary);
    cursor: pointer;
    user-select: none;
    font-size: 13px;
    font-weight: 400;
    border-radius: var(--radius-sm);
    position: relative;
  }

  .menu-button:hover:not(:disabled):not(.active) {
    background: var(--surface-hover);
    border: 1px solid transparent;
  }

  .menu-button.active {
    background: var(--dropdown-bg);
    backdrop-filter: blur(var(--dropdown-blur));
    -webkit-backdrop-filter: blur(var(--dropdown-blur));
    border: 1px solid var(--dropdown-border);
    border-bottom-color: var(--dropdown-bg);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .menu-button:active:not(:disabled) .menu-button-label {
    transform: scaleY(0.95) scaleX(1.15);
    display: inline-block;
  }

  .menu-button:active:not(:disabled) {
    background: var(--dropdown-bg);
    border: 1px solid var(--dropdown-border);
    color: var(--text-active);
    transform: scaleY(0.9) translateY(1px);
    /* letter-spacing: -0.1em; */
  }

  .menu-button.active::after {
    content: "";
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--dropdown-bg);
    z-index: 1001;
  }

  .menu-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Dropdown menu */
  .dropdown-menu {
    position: absolute;
    top: calc(100%);
    left: 0;
    background: var(--dropdown-bg);
    backdrop-filter: blur(var(--dropdown-blur));
    -webkit-backdrop-filter: blur(var(--dropdown-blur));
    border: 1px solid var(--dropdown-border);
    border-radius: var(--radius-md);
    border-top-left-radius: 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    overflow: visible;
    padding: 4px 0;
    min-width: 220px;
  }

  .dropdown-item-container {
    position: relative;
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
    position: relative;
  }

  .dropdown-item:hover {
    background: var(--dropdown-hover-bg);
  }

  .dropdown-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dropdown-item.disabled:hover {
    background: transparent;
  }

  .dropdown-item.has-submenu {
    padding-right: 8px;
  }

  .dropdown-item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    min-width: 14px;
  }

  .dropdown-item-label {
    flex: 1;
  }

  .dropdown-item-shortcut {
    font-size: 11px;
    color: var(--text-secondary);
    margin-left: auto;
  }

  .dropdown-item-check {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
    min-width: 14px;
    margin-left: 8px;
  }

  .dropdown-item-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    margin-left: 8px;
  }

  .dropdown-separator {
    height: 0;
    min-height: 0;
    max-height: 0;
    background: none;
    margin: 6px 0;
    border: none;
    border-top: 1px solid var(--border-primary);
    outline: none;
    flex-shrink: 0;
  }

  /* Submenu */
  .dropdown-submenu {
    position: absolute;
    left: 100%;
    top: -5px;
    background: var(--opaque-dropdown);
    border: 1px solid var(--dropdown-border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1002;
    overflow: hidden;
    padding: 4px 0;
    min-width: 160px;
  }
</style>
