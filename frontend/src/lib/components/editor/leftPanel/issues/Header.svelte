<script lang="ts">
  import { diagnostics } from "$lib/components/editor/context";

  let errors = $derived($diagnostics.filter((d) => d.severity === "error").length);
  let warnings = $derived(
    $diagnostics.filter((d) => d.severity === "warning").length,
  );
</script>

<div class="header">
  <div class="title">
    <div class="name">Issues</div>
    {#if errors > 0}
      <div class="badge error">{errors}</div>
    {/if}
    {#if warnings > 0}
      <div class="badge warning">{warnings}</div>
    {/if}
  </div>
</div>

<style>
  .header {
    width: 100%;
    padding: 1.5rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .name {
    font-size: 1.75rem;
    font-weight: bold;
    letter-spacing: -0.03em;
    margin-right: 0.2rem;
  }

  .badge {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    border-radius: 1rem;
    font-size: 0.68rem;
    font-weight: bold;
    padding: 0 0.5rem;
  }

  .badge.error {
    background-color: var(--color-error-bg);
    color: var(--color-error);
  }

  .badge.warning {
    background-color: var(--color-warning-bg);
    color: var(--color-warning);
  }
</style>
