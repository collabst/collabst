<script lang="ts">
  import type { Diagnostic } from "$lib/types";

  export let diagnostics: Diagnostic[] = [];
  export let gotoDiagnostic: (diagnostic: Diagnostic) => void;

  function handleKeydown(event: KeyboardEvent, diagnostic: Diagnostic) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      gotoDiagnostic(diagnostic);
    }
  }

  function severityValue(severity: string): number {
    switch (severity) {
      case "error":
        return 1;
      case "warning":
        return 2;
      case "info":
        return 3;
      case "hint":
        return 4;
      default:
        return 5;
    }
  }

  let sortedDiagnostics: Diagnostic[] = [];
  $: sortedDiagnostics = diagnostics.slice().sort((a, b) => {
    return severityValue(a.severity) - severityValue(b.severity);
  });
</script>

<div class="issues-panel">
  <div class="panel-header">
    <h3>Issues & Suggestions</h3>
  </div>
  <div class="panel-content">
    {#if diagnostics.length === 0}
      <p>No issues or suggestions found.</p>
    {:else}
      {#each sortedDiagnostics as diagnostic}
        <div
          class="issue-item issue-severity-{diagnostic.severity}"
          role="button"
          tabindex="0"
          on:click={() => gotoDiagnostic(diagnostic)}
          on:keydown={(e) => handleKeydown(e, diagnostic)}
        >
          <strong>{diagnostic.severity}: {diagnostic.message}</strong>
          {#if diagnostic.range}
            <p class="location-text">in {diagnostic.path}</p>
            <p class="location-text">
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
    width: 100%;
    height: calc(100% - var(--space-3));
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
    overflow-y: auto;
  }

  .issue-item {
    --transparent: 70%;
    width: 100%;
    padding: var(--space-3);
    margin-bottom: var(--space-3);
    border-radius: 16px;
    background: color-mix(
      in srgb,
      var(--color-bg),
      transparent var(--transparent)
    );
    border-left: 5px solid var(--color);
  }

  .issue-severity-error {
    --color: var(--color-error);
    --color-bg: var(--color-error-bg);
  }

  .issue-severity-warning {
    --color: var(--color-warning);
    --color-bg: var(--color-warning-bg);
  }

  .issue-severity-info {
    --color: var(--color-info);
    --color-bg: var(--color-info-bg);
  }

  .issue-severity-hint {
    --color: var(--color-hint);
    --color-bg: var(--color-hint-bg);
  }

  .issue-item:hover {
    --transparent: 50%;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
  }

  .issue-item:active {
    --transparent: 20%;
  }

  .location-text {
    font-size: var(--text-sm);
  }
</style>
