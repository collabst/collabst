<script lang="ts">
  import {
    replaceAllMatches,
    searchText,
    replaceText,
    caseSensitiveSearch,
    wholeWordSearch,
    regexSearch,
  } from "$lib/components/editor/context";
  import Button from "../Button.svelte";
  import CaseSensitive from "@lucide/svelte/icons/case-sensitive";
  import Regex from "@lucide/svelte/icons/regex";
  import WholeWord from "@lucide/svelte/icons/whole-word";
  import ReplaceAll from "@lucide/svelte/icons/replace-all";

  function caseSensitiveToggle() {
    $caseSensitiveSearch = !$caseSensitiveSearch;
  }

  function wholeWordToggle() {
    $wholeWordSearch = !$wholeWordSearch;
  }

  function regexToggle() {
    $regexSearch = !$regexSearch;
  }
</script>

<div class="header">
  <div class="name">Search</div>
  <div class="search-replace-container">
    <div class="search-area">
      <input
        class="search-input"
        type="text"
        placeholder="Search..."
        bind:value={$searchText}
      />
      <Button onclick={caseSensitiveToggle} selected={$caseSensitiveSearch}>
        <CaseSensitive />
      </Button>
      <Button onclick={wholeWordToggle} selected={$wholeWordSearch}>
        <WholeWord />
      </Button>
      <Button onclick={regexToggle} selected={$regexSearch}>
        <Regex />
      </Button>
    </div>
    <div class="replace-area">
      <input
        class="replace-input"
        type="text"
        placeholder="Replace..."
        bind:value={$replaceText}
      />
      <Button onclick={replaceAllMatches}>
        <ReplaceAll />
      </Button>
    </div>
  </div>
</div>

<style>
  .header {
    width: 100%;
    padding: 1.5rem 1.5rem;
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    flex-direction: column;
  }

  .name {
    font-size: 1.75rem;
    font-weight: bold;
    letter-spacing: -0.03em;
  }

  .search-replace-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .search-area,
  .replace-area {
    display: flex;
    width: 100%;
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    background: var(--bg-editor);
    align-items: center;
    padding: var(--space-1);
  }

  .search-input,
  .replace-input {
    flex: 1;
    padding-left: var(--space-1);
    font-size: var(--text-xs);
    color: var(--text-primary);
    background: var(--bg-editor);
    min-width: 0;
    border: 0;
  }
</style>
