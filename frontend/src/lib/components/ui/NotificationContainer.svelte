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
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column-reverse;
    gap: 0.5rem;
    z-index: 1000;
    pointer-events: none;
  }

  .notification-container :global(.notification) {
    pointer-events: auto;
  }
</style>
