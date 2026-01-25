<script lang="ts">
  export let action: "open" | "invite" | "delete";
  export let icon: any;
  export let title: string;
  export let href: string | undefined = undefined;
  export let onclick: ((e: MouseEvent) => void) | undefined = undefined;
</script>

{#if href}
  <a {href} class="action-btn {action}-action" {title}>
    <svelte:component this={icon} size={18} />
  </a>
{:else}
  <button {onclick} class="action-btn {action}-action" {title}>
    <svelte:component this={icon} size={18} />
  </button>
{/if}

<style>
  .action-btn {
    background: transparent;
    border: none;
    box-shadow: none;
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    pointer-events: auto;
    padding: 0.4rem;
  }

  .action-btn:hover {
    transform: scale(1.3);
    transition: none;
  }
  
  .action-btn:active {
    transform: scaleY(1.1) scaleX(1.5);
    transition: none;
  }

  .open-action:hover {
    color: var(--color-primary);
  }

  .invite-action:hover {
    color: #8ad48e;
  }

  /* Light theme: darker green for better contrast */
  :global([data-theme="light"]) .invite-action:hover {
    color: #1ea622;
  }

  .delete-action:hover {
    color: #ef7474;
  }

  /* Light theme: darker red for better contrast */
  :global([data-theme="light"]) .delete-action:hover {
    color: #c52525;
  }
</style>
