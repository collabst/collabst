<script lang="ts">
  import { clearSearchQuery, searchQuery, setSearchQuery } from "./context";
  import SearchIcon from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";
</script>

<label class="search">
  <SearchIcon size={15} />
  <input
    type="text"
    placeholder="Search projects…"
    value={$searchQuery}
    oninput={(e) => setSearchQuery(e.currentTarget.value)}
  />
  {#if $searchQuery}
    <button class="clear" onclick={clearSearchQuery} aria-label="Clear search">
      <X size={15} />
    </button>
  {/if}
</label>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 15rem;
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--navbar-border);
    border-radius: 0.7rem;
    background-color: var(--navbar-bg);
    box-shadow: inset 0 -3px 0 0 var(--navbar-shadow);
    color: var(--text-tertiary);
    cursor: text;
  }

  .search:focus-within {
    border-color: var(--color-tertiary-500);
  }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font: inherit;
    font-size: 0.875rem;
  }

  input::placeholder {
    color: var(--text-tertiary);
  }

  .clear {
    display: flex;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
  }

  .clear:hover {
    color: var(--color-error);
  }
</style>
