<script lang="ts">
  import { gotoDiagnostic } from "$lib/components/editor/context";
  import type { Diagnostic } from "$lib/types";

  interface Props {
    diagnostic: Diagnostic;
  }

  let { diagnostic }: Props = $props();
  let severity = $derived(`severity-${diagnostic.severity || "unknown"}`);
</script>

<button
  class="diagnostic {severity}"
  onclick={() => gotoDiagnostic(diagnostic)}
>
  <div class="message">
    {diagnostic.severity}: {diagnostic.message}
  </div>
  {#if diagnostic.range}
    <div class="location">
      <div class="path">in {diagnostic.path}</div>
      <div class="line-column">
        at
        {diagnostic.range.start.line + 1}:{diagnostic.range.start.character + 1}
        -
        {diagnostic.range.end.line + 1}:{diagnostic.range.end.character + 1}
      </div>
    </div>
  {/if}
</button>

<style>
  .diagnostic {
    flex: 1;
    padding: 1rem 1.5rem;
    margin: 0.5rem;
    border-radius: 0.7rem;
    background: var(--color-bg);
    border: 1px solid var(--color);
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--color);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: left;
  }

  .severity-error {
    --color: var(--color-error);
    --color-bg: var(--color-error-bg);
  }

  .severity-warning {
    --color: var(--color-warning);
    --color-bg: var(--color-warning-bg);
  }

  .severity-info {
    --color: var(--color-info);
    --color-bg: var(--color-info-bg);
  }

  .severity-hint {
    --color: var(--color-hint);
    --color-bg: var(--color-hint-bg);
  }

  .message {
    font-weight: bold;
  }

  .location {
    font-size: 0.8rem;
  }
</style>
