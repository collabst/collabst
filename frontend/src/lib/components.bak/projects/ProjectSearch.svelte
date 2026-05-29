<script lang="ts">
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";

  let { value = $bindable("") } = $props();
</script>

<label class="search-bar">
  <Search size={16} class="search-icon" />
  <input
    type="text"
    bind:value
    placeholder="Search projects..."
    class="search-input"
  />
  {#if value}
    <button
      onclick={() => (value = "")}
      class="search-clear"
      aria-label="Clear search"
    >
      <X size={16} />
    </button>
  {/if}
</label>

<style>
  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--bg-primary);
    border: 2px solid var(--border-primary);
    border-radius: 4px;
    padding: 0.55rem 0.75rem;
    gap: 0.5rem;
    min-width: 280px;
    cursor: text;
  }

  .search-bar :global(.search-icon) {
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .search-bar:hover {
    border-color: var(--border-secondary);
  }

  .search-bar:focus-within {
    border-color: var(--color-primary-500);
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 14px;
    padding: 0;
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .search-clear {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .search-clear:hover {
    color: var(--text-primary);
  }

  .search-clear:active {
    color: var(--color-error-glow);
  }
</style>
