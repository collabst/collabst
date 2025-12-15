<script lang="ts">
  import { notifications, type Notification } from '$lib/stores/notifications'

  export let notification: Notification
</script>

<div 
  class="notification notification-{notification.type}" 
  class:closing={notification.closing}
>
  <span>{notification.message}</span>
  <button class="notification-close" on:click={() => notifications.hide(notification.id)}>×</button>
</div>

<style>

  .notification {
    position: fixed;
    top: 1rem;
    right: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease;
  }

  .notification.closing {
    animation: slideOut 0.3s ease forwards;
  }

  @keyframes slideIn {
    from {
      transform: translateX(calc(100% + 1rem));
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(calc(100% + 1rem));
      opacity: 0;
    }
  }

  .notification-info {
    background: var(--color-info-bg);
    color: var(--color-info-text);
    border: 1px solid var(--color-info);
  }

  .notification-warning {
    background: var(--color-warning-bg);
    color: var(--color-warning-text);
    border: 1px solid var(--color-warning);
  }

  .notification-error {
    background: var(--color-error-bg);
    color: var(--color-error-text);
    border: 1px solid var(--color-error);
  }

  .notification-close {
    background: transparent;
    border: none;
    color: inherit;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
  }

  .notification-close:hover {
    opacity: 1;
  }
</style>
