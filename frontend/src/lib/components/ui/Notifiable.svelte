<script lang="ts">
  type NotificationType =
    | 'error'
    | 'warning'
    | 'info'
    | 'hint'
    | 'comments'

  export let hasNotification: boolean = false
  export let position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right'
  export let size: number = 20
  export let count: number | null = null
  export let type: NotificationType = 'error'
</script>

<div class="notifiable" class:has-notification={hasNotification}>
  <slot />
  {#if hasNotification}
    <div
      class={`notification-dot type-${type}`}
      class:position
      class:has-count={count !== null}
      style="--dot-size: {size}px"
    >
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
    border-radius: 50px;
    background: var(--color-error);
    box-shadow: 0 0 10px var(--color-error-glow);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: fit-content;
  }

  .notification-dot.type-error {
    background: var(--color-error);
    box-shadow: 0 0 10px var(--color-error-glow);
  }

  .notification-dot.type-warning {
    background: var(--color-warning);
    box-shadow: 0 0 10px var(--color-warning-glow);
  }

  .notification-dot.type-info {
    background: var(--color-info);
    box-shadow: 0 0 10px var(--color-info-glow);
  }

  .notification-dot.type-hint {
    background: var(--color-hint);
    box-shadow: 0 0 10px var(--color-hint-glow);
  }

  .notification-dot.type-comments {
    background: var(--color-comment);
    box-shadow: 0 0 10px var(--color-comments-glow);
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
