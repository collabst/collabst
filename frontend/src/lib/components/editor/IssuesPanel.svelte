<script lang="ts">
  import type { Diagnostic } from "$lib/types";

  export let diagnostics: Diagnostic[] = [];
</script>

<div class="issues-panel">
  <div class="panel-header">
    <h3>Issues and Suggestions</h3>
  </div>
  <div class="panel-content">
    {#if diagnostics.length === 0}
      <p>No issues or suggestions found.</p>
    {:else}
      {#each diagnostics as diagnostic}
        <div class="issue-item issue-severity-{diagnostic.severity}">
          <strong>{diagnostic.severity}: {diagnostic.message}</strong>
          {#if diagnostic.range}
            <p>in {diagnostic.path}</p>
            <p>
              at
              {diagnostic.range.start.line + 1}:{diagnostic.range.start
                .character + 1}
              -
              {diagnostic.range.end.line + 1}:{diagnostic.range.end.character +
                1}
            </p>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .issues-panel {
    width: 280px;
    background: var(--bg-file-panel);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 8px;
    margin: 0 0 var(--space-3) 0;
    padding-right: 0;
  }

  .panel-header {
    padding: var(--space-4);
  }

  h3 {
    margin: 0;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .panel-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-4);
  }

  .issue-item {
    width: 100%;
    padding: var(--space-3);
    margin-bottom: var(--space-3);
    border-radius: 6px;
    background: var(--bg-issue-item);
  }

  .issue-severity-error {
    border-left: 4px solid var(--color-error);
  }

  .issue-severity-warning {
    border-left: 4px solid var(--color-warning);
  }

  .issue-severity-info {
    border-left: 4px solid var(--color-info);
  }

  .issue-severity-hint {
    border-left: 4px solid var(--color-hint);
  }
</style>
