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
    width: 100%;
    height: 100%;
    background: var(--bg-file-panel);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 8px;
    margin: 0 0 var(--space-3) 0;
    padding-top: 4px;
  }

  .panel-header {
    padding: var(--space-4);
  }

  h3 {
    margin: 0;
    font-size: 1.1rem;
    letter-spacing: -0.015em;
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
