<script lang="ts">
  import type { Snippet } from 'svelte'
  
  interface PanelProps {
    title?: string
    subtitle?: string
    padding?: boolean
    class?: string
    children?: Snippet
    actions?: Snippet
  }
  
  let {
    title = '',
    subtitle = '',
    padding = true,
    class: className = '',
    children,
    actions
  }: PanelProps = $props()
</script>

<div class="panel {className}">
  {#if title || actions}
    <div class="panel-header">
      <div class="panel-header-content">
        {#if title}
          <h3 class="panel-title">{title}</h3>
        {/if}
        {#if subtitle}
          <p class="panel-subtitle">{subtitle}</p>
        {/if}
      </div>
      {#if actions}
        <div class="panel-actions">
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}
  
  <div class="panel-body {padding ? 'panel-padding' : ''}">
    {@render children?.()}
  </div>
</div>

<style>
  .panel {
    background: var(--surface-primary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4) var(--space-6);
    border-bottom: 1px solid var(--border-primary);
    background: var(--surface-secondary);
  }
  
  .panel-header-content {
    flex: 1;
  }
  
  .panel-title {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0;
  }
  
  .panel-subtitle {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
    margin: var(--space-1) 0 0 0;
  }
  
  .panel-actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  
  .panel-body {
    overflow: auto;
  }
  
  .panel-padding {
    padding: var(--space-6);
  }
</style>
