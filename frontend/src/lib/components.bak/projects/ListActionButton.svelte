<script lang="ts">
  export let action: "open" | "invite" | "delete";
  export let icon: any;
  export let title: string;
  export let href: string | undefined = undefined;
  export let onclick: ((e: MouseEvent) => void) | undefined = undefined;
</script>

{#if href}
  <a {href} class="action-btn {action}-action" {title}>
    <svelte:component this={icon} size={19} />
  </a>
{:else}
  <button {onclick} class="action-btn {action}-action" {title}>
    <svelte:component this={icon} size={19} />
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

  .action-btn:hover :global(svg) {
    animation: jumpAnimation 0.2s ease-out;
    stroke-width: 2.5;
  }

  @keyframes jumpAnimation {
    0% {
      transform: translateY(-2px) scaleX(0.8) scaleY(1.1);
    }
    80% {
      transform: translateY(1px) scaleX(1.1) scaleY(0.95);
    }
    100% {
      transform: none;
    }
  }
  
  .action-btn:active {
    transform: scaleY(0.9) scaleX(1.15);
    transition: none;
  }

  .open-action:hover {
    color: var(--text-active);
  }

  .invite-action:hover {
    color: #8ce991;
  }

  /* Light theme: darker green for better contrast */
  :global([data-theme="light"]) .invite-action:hover {
    color: #1ea622;
  }

  .delete-action:hover {
    color: #ff7b7b;
  }

  /* Light theme: darker red for better contrast */
  :global([data-theme="light"]) .delete-action:hover {
    color: #c52525;
  }
</style>
