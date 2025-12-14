<script lang="ts">
  import type { Snippet } from 'svelte'
  import { onMount } from 'svelte'
  
  interface TooltipProps {
    text: string
    position?: 'top' | 'bottom' | 'left' | 'right'
    delay?: number
    children?: Snippet
  }
  
  let {
    text,
    position = 'top',
    delay = 400,
    children
  }: TooltipProps = $props()
  
  let showTooltip = $state(false)
  let timeoutId: number | null = null
  let wrapperEl: HTMLDivElement | null = null
  let tooltipEl: HTMLDivElement | null = null
  let tooltipStyle = $state('')

  function updateTooltipPosition() {
    if (!wrapperEl || !tooltipEl) return
    
    const wrapperRect = wrapperEl.getBoundingClientRect()
    const tooltipRect = tooltipEl.getBoundingClientRect()
    
    let top = 0
    let left = 0
    
    switch (position) {
      case 'top':
        top = wrapperRect.top - tooltipRect.height - 8
        left = wrapperRect.left + wrapperRect.width / 2 - tooltipRect.width / 2
        break
      case 'bottom':
        top = wrapperRect.bottom + 8
        left = wrapperRect.left + wrapperRect.width / 2 - tooltipRect.width / 2
        break
      case 'left':
        top = wrapperRect.top + wrapperRect.height / 2 - tooltipRect.height / 2
        left = wrapperRect.left - tooltipRect.width - 8
        break
      case 'right':
        top = wrapperRect.top + wrapperRect.height / 2 - tooltipRect.height / 2
        left = wrapperRect.right + 8
        break
    }
    
    tooltipStyle = `top: ${top}px; left: ${left}px;`
  }

  function handleMouseEnter() {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => {
      showTooltip = true
      requestAnimationFrame(() => {
        updateTooltipPosition()
      })
    }, delay)
  }

  function handleMouseLeave() {
    if (timeoutId) clearTimeout(timeoutId)
    showTooltip = false
  }

  function handleClick() {
    if (timeoutId) clearTimeout(timeoutId)
    showTooltip = false
  }
</script>

<div 
  bind:this={wrapperEl}
  class="tooltip-wrapper"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  onclick={handleClick}
  role="tooltip"
>
  {@render children?.()}
  
  {#if showTooltip && text}
    <div bind:this={tooltipEl} class="tooltip" style={tooltipStyle}>
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
    position: fixed;
    background: var(--bg-editor);
    color: var(--text-primary);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    white-space: nowrap;
    z-index: 10000;
    pointer-events: none;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-primary);
    animation: fadeIn var(--transition-fast);
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
