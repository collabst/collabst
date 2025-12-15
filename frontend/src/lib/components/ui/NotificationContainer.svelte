<script lang="ts">
  import { notifications } from '$lib/stores/notifications'
  import Notification from './Notification.svelte'
</script>

<div class="notification-container">
  {#each $notifications as notification (notification.id)}
    <Notification {notification} />
  {/each}
</div>

<style>
  .notification-container {
    position: fixed;
    top: 1rem;
    right: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 1000;
    pointer-events: none;
  }

  .notification-container :global(.notification) {
    pointer-events: auto;
  }
</style>
