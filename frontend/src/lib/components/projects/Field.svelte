<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label: string;
    forId: string;
    children: Snippet;
    hint?: string;
  }

  let { label, forId, children, hint }: Props = $props();
</script>

<div class="field">
  <label for={forId}>{label}</label>
  {@render children()}
  {#if hint}<span class="hint">{hint}</span>{/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .hint {
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }

  /* Inputs are supplied by the caller, so they are styled from here. */
  .field :global(input),
  .field :global(textarea),
  .field :global(select) {
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--border-primary);
    border-radius: 0.6rem;
    background-color: var(--bg-input);
    color: var(--text-primary);
    font: inherit;
    font-size: 0.875rem;
  }

  .field :global(textarea) {
    min-height: 4.5rem;
    resize: vertical;
  }

  .field :global(input:focus),
  .field :global(textarea:focus),
  .field :global(select:focus) {
    border-color: var(--color-tertiary-500);
  }

  .field :global(input::placeholder),
  .field :global(textarea::placeholder) {
    color: var(--text-tertiary);
  }
</style>
