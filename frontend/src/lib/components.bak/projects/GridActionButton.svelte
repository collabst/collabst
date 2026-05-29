<script lang="ts">
  export let action: "open" | "invite" | "delete";
  export let label: string;
  export let icon: any;
  export let href: string | undefined = undefined;
  export let onclick: ((e: MouseEvent) => void) | undefined = undefined;
</script>

{#if href}
  <a {href} class="action-btn {action}-action" title={label}>
    <svelte:component this={icon} size={16} />
    <span class="action-label">{label}</span>
  </a>
{:else}
  <button {onclick} class="action-btn {action}-action" title={label}>
    <svelte:component this={icon} size={16} />
    <span class="action-label">{label}</span>
  </button>
{/if}

<style>
  .action-btn {
    background: #233133;
    border: 1px solid var(--border-primary);
    color: var(--text-primary);
    padding: 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    position: relative;
    text-decoration: none;
    pointer-events: auto;
  }

  :global([data-theme="light"]) .action-btn {
    background: #d1e6e8;
  }

  .action-btn .action-label {
    position: absolute;
    top: -2rem;
    left: 50%;
    transform: translateX(-50%);
    background: #233133;
    border: 1px solid var(--border-primary);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 13px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  :global([data-theme="light"]) .action-btn .action-label {
    background: #d1e6e8;
  }

  .action-btn:hover .action-label {
    opacity: 1;
  }

  .action-btn:hover {
    transform: scale(1.1);
  }

  .open-action:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .invite-action:hover {
    border-color: #8ad48e;
    color: #8ad48e;
  }

  /* Light theme: darker green for better contrast */
  :global([data-theme="light"]) .invite-action:hover {
    border-color: #1ea622;
    color: #1ea622;
  }

  .delete-action:hover {
    border-color: #ef7474;
    color: #ef7474;
  }

  /* Light theme: darker red for better contrast */
  :global([data-theme="light"]) .delete-action:hover {
    border-color: #c52525;
    color: #c52525;
  }
</style>
