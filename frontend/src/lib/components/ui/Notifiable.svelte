<script lang="ts">
  export let hasNotification: boolean = false
  export let position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right'
  export let color: string = 'var(--color-error)'
  export let size: number = 8
</script>

<div class="notifiable" class:has-notification={hasNotification}>
  <slot />
  {#if hasNotification}
    <div class="notification-dot" class:position style="--dot-color: {color}; --dot-size: {size}px" />
  {/if}
</div>

<style>
  .notifiable {
    position: relative;
    display: inline-block;
  }

  .notification-dot {
    position: absolute;
    width: var(--dot-size);
    height: var(--dot-size);
    border-radius: 50%;
    background: var(--dot-color);
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
  }

  .notification-dot.position {
    width: var(--dot-size);
    height: var(--dot-size);
  }

  .notifiable :global(.notification-dot:not([class*="position"])),
  .notifiable :global(.notification-dot.position:not([class*="top-left"]):not([class*="bottom-right"]):not([class*="bottom-left"])) {
    top: calc(var(--dot-size) * -0.5);
    right: calc(var(--dot-size) * -0.5);
  }

  .notifiable :global(.notification-dot.position) {
    top: calc(var(--dot-size) * -0.5);
    right: calc(var(--dot-size) * -0.5);
  }
</style>
