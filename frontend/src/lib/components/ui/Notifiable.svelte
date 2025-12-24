<script lang="ts">
  export let hasNotification: boolean = false
  export let position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right'
  export let size: number = 20
  export let count: number | null = null
</script>

<div class="notifiable" class:has-notification={hasNotification}>
  <slot />
  {#if hasNotification}
    <div class="notification-dot" class:position class:has-count={count !== null} style="--dot-size: {size}px">
      {#if count !== null}
        <span class="count-text">{count}</span>
      {/if}
    </div>
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
    background: var(--color-error);
    box-shadow: 0 0 10px rgba(255, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .count-text {
    font-size: 11px;
    font-weight: 600;
    color: white;
    line-height: 1;
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
