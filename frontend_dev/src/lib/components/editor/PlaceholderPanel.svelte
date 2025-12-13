<script lang="ts">
  export let title: string
</script>

<div class="placeholder-panel">
  <div class="panel-header">
    <h3>{title}</h3>
  </div>
  <div class="panel-content">
    <p class="todo-message">TODO: {title} feature coming soon</p>
  </div>
</div>

<style>
  .placeholder-panel {
    width: 280px;
    background: var(--bg-file-panel);
    border-right: 1px solid var(--border-primary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .panel-header {
    padding: var(--space-4);
    border-bottom: 1px solid var(--border-primary);
  }

  h3 {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .panel-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
  }

  .todo-message {
    color: var(--text-tertiary);
    font-size: var(--text-sm);
    text-align: center;
    font-style: italic;
  }
</style>
