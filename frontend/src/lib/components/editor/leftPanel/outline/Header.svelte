<script lang="ts">
  import { outline } from "$lib/components/editor/context";
</script>

<div class="header">
  <div class="title">
    <div class="name">Outline</div>
    {#if $outline.length > 0}
      <div class="badge">{$outline.length}</div>
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
    gap: 0.6rem;
  }

  .name {
    font-size: 1.75rem;
    font-weight: bold;
    letter-spacing: -0.03em;
  }

  .badge {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    border-radius: 1rem;
    background-color: var(--surface-hover);
    font-size: 0.68rem;
    font-weight: bold;
    color: var(--text-secondary);
    padding: 0 0.5rem;
  }
</style>
