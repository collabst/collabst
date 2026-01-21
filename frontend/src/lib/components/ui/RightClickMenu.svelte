<script lang="ts">
  export interface RightClickMenuItem {
    label: string;
    icon?: any;
    onclick: () => void;
    separator?: boolean; // Add separator after this item
  }

  interface Props {
    show: boolean;
    x: number;
    y: number;
    items: RightClickMenuItem[];
    onClose: () => void;
  }

  let { show = $bindable(), x, y, items, onClose }: Props = $props();

  let menuElement = $state<HTMLDivElement | undefined>();

  function handleClickOutside(event: MouseEvent) {
    if (menuElement && !menuElement.contains(event.target as Node)) {
      onClose();
    }
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
  }

  $effect(() => {
    if (show) {
      // Add listeners when menu opens
      setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
        document.addEventListener("contextmenu", handleClickOutside);
      }, 0);

      return () => {
        document.removeEventListener("click", handleClickOutside);
        document.removeEventListener("contextmenu", handleClickOutside);
      };
    }
  });

  function handleItemClick(item: RightClickMenuItem) {
    item.onclick();
    onClose();
  }
</script>

{#if show}
  <div
    bind:this={menuElement}
    class="right-click-menu"
    style="top: {y}px; left: {x}px;"
    oncontextmenu={handleContextMenu}
    role="menu"
    tabindex="-1"
  >
    {#each items as item, i}
      <button
        class="menu-item"
        onclick={() => handleItemClick(item)}
        role="menuitem"
      >
        {#if item.icon}
          {@const Icon = item.icon}
          <span class="menu-icon">
            <Icon size={16} />
          </span>
        {/if}
        <span class="menu-label">{item.label}</span>
      </button>
      {#if item.separator && i < items.length - 1}
        <div class="menu-separator"></div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .right-click-menu {
    position: fixed;
    background: var(--dropdown-bg);
    backdrop-filter: blur(var(--dropdown-blur));
    -webkit-backdrop-filter: blur(var(--dropdown-blur));
    border: 1px solid var(--surface-hover);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    overflow: hidden;
    min-width: 130px;
  }

  .menu-item {
    width: 100%;
    background: transparent;
    border: none;
    color: var(--text-primary);
    padding: 0.5rem 0.75rem;
    text-align: center;
    cursor: pointer;
    font-size: 14px;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .menu-item:hover {
    background: var(--surface-hover);
  }

  .menu-item:active {
    background: var(--surface-active);
  }

  .menu-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .menu-label {
    flex: 1;
  }

  .menu-separator {
    height: 1px;
    background: var(--border-primary);
    margin: 0.25rem 0;
  }
</style>
