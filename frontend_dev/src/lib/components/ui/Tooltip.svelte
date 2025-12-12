<script lang="ts">
  import type { Snippet } from 'svelte'
  
  interface TooltipProps {
    text: string
    position?: 'top' | 'bottom' | 'left' | 'right'
    children?: Snippet
  }
  
  let {
    text,
    position = 'top',
    children
  }: TooltipProps = $props()
  
  let showTooltip = $state(false)
</script>

<div 
  class="tooltip-wrapper"
  onmouseenter={() => showTooltip = true}
  onmouseleave={() => showTooltip = false}
  role="tooltip"
>
  {@render children?.()}
  
  {#if showTooltip && text}
    <div class="tooltip tooltip-{position}">
      {text}
    </div>
  {/if}
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-block;
  }
  
  .tooltip {
    position: absolute;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    white-space: nowrap;
    z-index: 9999;
    pointer-events: none;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-primary);
    animation: fadeIn var(--transition-fast);
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  .tooltip-top {
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
  }
  
  .tooltip-bottom {
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
  }
  
  .tooltip-left {
    right: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
  }
  
  .tooltip-right {
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
  }
</style>
