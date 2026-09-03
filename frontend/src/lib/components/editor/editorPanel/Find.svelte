<script lang="ts">
  import {
    canWrite,
    closeFind,
    findCaseSensitive,
    findMatchCount,
    findMatchIndex,
    findNextMatch,
    findPreviousMatch,
    findQuery,
    findRegex,
    findReplace,
    findWholeWord,
    replaceAllFindMatches,
    replaceFindMatch,
    selectAllFindMatches,
  } from "$lib/components/editor/context";
  import Button from "./toolbar/Button.svelte";
  import AlignJustify from "@lucide/svelte/icons/align-justify";
  import CaseSensitive from "@lucide/svelte/icons/case-sensitive";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import Regex from "@lucide/svelte/icons/regex";
  import Replace from "@lucide/svelte/icons/replace";
  import ReplaceAll from "@lucide/svelte/icons/replace-all";
  import WholeWord from "@lucide/svelte/icons/whole-word";
  import X from "@lucide/svelte/icons/x";

  let searchInput: HTMLInputElement | undefined = $state();

  // Opening the panel over a word people just looked for should let them type
  // straight over it.
  $effect(() => {
    searchInput?.select();
  });

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (event.shiftKey) {
      findPreviousMatch();
    } else {
      findNextMatch();
    }
  }

  let status = $derived(
    $findQuery === ""
      ? ""
      : $findMatchCount === 0
        ? "No results"
        : `${$findMatchIndex || "?"} of ${$findMatchCount}`,
  );
</script>

<div class="find">
  <div class="row">
    <div class="field">
      <input
        bind:this={searchInput}
        bind:value={$findQuery}
        type="text"
        spellcheck="false"
        placeholder="Find"
        onkeydown={handleSearchKeydown}
      />
      <span class="status">{status}</span>
      <Button
        icon={CaseSensitive}
        title="Match case"
        class={$findCaseSensitive ? "on" : ""}
        onclick={() => ($findCaseSensitive = !$findCaseSensitive)}
      />
      <Button
        icon={WholeWord}
        title="Whole word"
        class={$findWholeWord ? "on" : ""}
        onclick={() => ($findWholeWord = !$findWholeWord)}
      />
      <Button
        icon={Regex}
        title="Regular expression"
        class={$findRegex ? "on" : ""}
        onclick={() => ($findRegex = !$findRegex)}
      />
    </div>
    <Button icon={ChevronDown} title="Next" onclick={findNextMatch} />
    <Button icon={ChevronUp} title="Previous" onclick={findPreviousMatch} />
    <Button icon={AlignJustify} title="Select all" onclick={selectAllFindMatches} />
    <Button icon={X} title="Close" onclick={closeFind} />
  </div>

  {#if $canWrite}
    <div class="row">
      <div class="field">
        <input
          bind:value={$findReplace}
          type="text"
          spellcheck="false"
          placeholder="Replace"
        />
      </div>
      <Button icon={Replace} title="Replace" onclick={replaceFindMatch} />
      <Button
        icon={ReplaceAll}
        title="Replace all"
        onclick={replaceAllFindMatches}
      />
    </div>
  {/if}
</div>

<style>
  .find {
    position: absolute;
    top: 0.5rem;
    right: 0.75rem;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.35rem;
    border-radius: 0.75rem;
    background-color: color-mix(in srgb, var(--bg-primary), transparent 5%);
    backdrop-filter: blur(12px);
    border: 1px solid var(--border-primary);
    box-shadow: 0 12px 28px -14px rgb(0 0 0 / 0.4);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.15rem;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    flex: 1;
    padding: 0.1rem 0.25rem;
    border: 1px solid var(--border-primary);
    border-radius: 0.5rem;
    background: var(--bg-editor);
  }

  .field input {
    flex: 1;
    min-width: 9rem;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font: inherit;
    font-size: 0.8rem;
    padding: 0.2rem 0.25rem;
    outline: none;
  }

  .status {
    font-size: 0.7rem;
    color: var(--text-tertiary);
    white-space: nowrap;
    padding-right: 0.25rem;
  }

  .find :global(.button.on) {
    color: var(--color-primary-500);
  }

  .find :global(.button.on svg) {
    stroke-width: 2.4;
  }
</style>
