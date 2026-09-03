<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label: string;
    forId?: string;
    hint?: string;
    children: Snippet;
  }

  let { label, forId, hint, children }: Props = $props();
</script>

<div class="row">
  <div class="text">
    <label for={forId}>{label}</label>
    {#if hint}<span class="hint">{hint}</span>{/if}
  </div>
  <div class="control">
    {@render children()}
  </div>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 2.25rem;
  }

  .text {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  label {
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .hint {
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }

  .control {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .control :global(input[type="text"]),
  .control :global(input[type="number"]),
  .control :global(input[type="email"]),
  .control :global(input[type="password"]) {
    width: 11rem;
    padding: 0.35rem 0.55rem;
    border: 1px solid var(--border-primary);
    border-radius: 0.55rem;
    background-color: var(--bg-input);
    color: var(--text-primary);
    font: inherit;
    font-size: 0.85rem;
  }

  .control :global(input:focus) {
    border-color: var(--color-tertiary-500);
  }
</style>
