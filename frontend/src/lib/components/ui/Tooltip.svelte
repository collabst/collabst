<script lang="ts">
  import type { Snippet } from 'svelte'
  import { onMount } from 'svelte'
  
  interface TooltipProps {
    text: string
    shortcut?: string
    position?: 'top' | 'bottom' | 'left' | 'right'
    delay?: number
    children?: Snippet
  }
  
  let {
    text,
    shortcut,
    position = 'top',
    delay = 400,
    children
  }: TooltipProps = $props()
  
  let showTooltip = $state(false)
  let timeoutId: number | null = null
  let wrapperEl: HTMLDivElement | null = null
  let tooltipEl = $state<HTMLDivElement | null>(null)
  let tooltipStyle = $state('')

  function updateTooltipPosition() {
    if (!wrapperEl || !tooltipEl) return
    
    const wrapperRect = wrapperEl.getBoundingClientRect()
    const tooltipRect = tooltipEl.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
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
    
    // Adjust horizontal position to keep tooltip on screen
    if (left + tooltipRect.width > viewportWidth - 8) {
      left = viewportWidth - tooltipRect.width - 8
    }
    if (left < 8) {
      left = 8
    }
    
    // Adjust vertical position to keep tooltip on screen
    if (top + tooltipRect.height > viewportHeight - 8) {
      top = viewportHeight - tooltipRect.height - 8
    }
    if (top < 8) {
      top = 8
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
  role="presentation"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
>
  <span onclick={handleClick} onkeydown={handleClick} role="button" tabindex="0" style="display: contents;">
    {@render children?.()}
  </span>
  
  {#if showTooltip && text}
    <div bind:this={tooltipEl} class="tooltip" style={tooltipStyle}>
      <span class="tooltip-text">{text}</span>
      {#if shortcut}
        <span class="tooltip-shortcut">{shortcut}</span>
      {/if}
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
    font-family: var(--font-sans);
    white-space: nowrap;
    z-index: 10000;
    pointer-events: none;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-primary);
    animation: fadeIn var(--transition-fast);
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  
  .tooltip-text {
    flex: 1;
  }
  
  .tooltip-shortcut {
    font-size: 11px;
    color: var(--text-secondary);
    margin-left: auto;
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
