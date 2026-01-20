<script lang="ts">
  import { onMount, tick } from 'svelte'
  import {
    SearchQuery,
    setSearchQuery,
    findNext,
    findPrevious,
    selectMatches,
    replaceNext,
    replaceAll,
    getSearchQuery,
    closeSearchPanel,
    searchPanelOpen,
  } from '@codemirror/search'
  import type { EditorView } from '@codemirror/view'
  import CaseSensitive from '@lucide/svelte/icons/case-sensitive'
  import WholeWord from '@lucide/svelte/icons/whole-word'
  import Regex from '@lucide/svelte/icons/regex'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronUp from '@lucide/svelte/icons/chevron-up'
  import AlignJustify from '@lucide/svelte/icons/align-justify'
  import Replace from '@lucide/svelte/icons/replace'
  import ReplaceAll from '@lucide/svelte/icons/replace-all'
  import X from '@lucide/svelte/icons/x'
  import IconButton from '../ui/IconButton.svelte'
  import ToolButton from '../ui/ToolButton.svelte'
  import Tooltip from '../ui/Tooltip.svelte'

  interface FindProps {
    view: EditorView
  }

  let { view }: FindProps = $props()

  let searchInput: HTMLInputElement | undefined
  let replaceInput: HTMLInputElement | undefined
  let searchTerm = $state('')
  let replaceTerm = $state('')
  let caseSensitive = $state(false)
  let wholeWord = $state(false)
  let regex = $state(false)

  // Pre-populate search term from current selection
  let query = getSearchQuery(view.state)
  searchTerm = query.search

  // Select search input content on mount
  onMount(() => {
    tick().then(() => {
      searchInput?.select()
    })
  })

  // Update search when any parameter changes
  $effect(() => {
    let query = new SearchQuery({
      search: searchTerm,
      replace: replaceTerm,
      caseSensitive,
      wholeWord,
      regexp: regex,
    })
    view.dispatch({
      effects: setSearchQuery.of(query),
    })
  })

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (searchPanelOpen(view.state)) {
        closeSearchPanel(view)
      }
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        prev()
      } else {
        next()
      }
      return
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      replaceInput?.focus()
    }
  }

  function handleReplaceKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (searchPanelOpen(view.state)) {
        closeSearchPanel(view)
      }
      return
    }
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      searchInput?.focus()
    }
  }

  function next() {
    findNext(view)
  }

  function prev() {
    findPrevious(view)
  }

  function all() {
    selectMatches(view)
  }

  function replace() {
    replaceNext(view)
  }

  function _replaceAll() {
    replaceAll(view)
  }

  function close() {
    closeSearchPanel(view)
  }
</script>

<div class="find-panel">
  <div class="find-row">
    <div class="search-area">
      <input
        bind:this={searchInput}
        type="text"
        spellcheck="false"
        placeholder="Find"
        bind:value={searchTerm}
        class="search-input"
        onkeydown={handleSearchKeydown}
      />
      <Tooltip text="Case Sensitive" position="top">
        <IconButton
          variant="flat"
          icon={CaseSensitive}
          size="sm"
          onclick={() => (caseSensitive = !caseSensitive)}
          selected={caseSensitive}
        />
      </Tooltip>
      <Tooltip text="Match Whole Word" position="top">
        <IconButton
          variant="flat"
          icon={WholeWord}
          size="sm"
          onclick={() => (wholeWord = !wholeWord)}
          selected={wholeWord}
        />
      </Tooltip>
      <Tooltip text="Use Regular Expressions" position="top">
        <IconButton
          variant="flat"
          icon={Regex}
          size="sm"
          onclick={() => (regex = !regex)}
          selected={regex}
        />
      </Tooltip>
    </div>
    <div class="button-group">
      <Tooltip text="Next" shortcut="Enter" position="top">
        <ToolButton
          icon={ChevronDown}
          onclick={next}
          position="first"
        />
      </Tooltip>
      <Tooltip text="Previous" shortcut="Shift Enter" position="top">
        <ToolButton
          icon={ChevronUp}
          onclick={prev}
          position="middle"
        />
      </Tooltip>
      <Tooltip text="Select All" position="top">
        <ToolButton
          icon={AlignJustify}
          onclick={all}
          position="last"
        />
      </Tooltip>
    </div>
    <Tooltip text="Close" position="top">
      <IconButton
        variant="flat"
        icon={X}
        size="sm"
        onclick={close}
        class="close-btn"
      />
    </Tooltip>
  </div>

  <div class="find-row">
    <div class="replace-area">
      <input
        bind:this={replaceInput}
        type="text"
        spellcheck="false"
        placeholder="Replace"
        bind:value={replaceTerm}
        class="replace-input"
        onkeydown={handleReplaceKeydown}
      />
    </div>
    <div class="button-group">
      <Tooltip text="Replace" position="top">
        <ToolButton
          icon={Replace}
          onclick={replace}
          position="first"
        />
      </Tooltip>
      <Tooltip text="Replace All" position="top">
        <ToolButton
          icon={ReplaceAll}
          onclick={_replaceAll}
          position="last"
        />
      </Tooltip>
    </div>
    <div class="spacer"></div>
  </div>
</div>

<style>
  .find-panel {
    position: absolute;
    bottom: 8px;
    left: 8px;
    background: var(--find-bg);
    backdrop-filter: blur(var(--find-blur));
    -webkit-backdrop-filter: blur(var(--find-blur));
    border: 1px solid var(--dropdown-border);
    /* background: var(--bg-top-panel);
    border: 1px solid var(--border-primary); */
    border-radius: 14px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-shadow: 0 0px 15px rgba(0, 0, 0, 0.1);
    z-index: 20;
    min-width: 450px;
    max-width: 90vw;
  }

  .find-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .search-area,
  .replace-area {
    display: flex;
    gap: 4px;
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    background: var(--bg-editor);
    align-items: center;
    padding: 4px;
  }

  .search-input,
  .replace-input {
    flex: 1;
    padding: 4px 8px;
    font-size: 0.9em;
    color: var(--text-primary);
    background: var(--bg-editor);
    border: none;
    outline: none;
    min-height: 26px;
    min-width: 0;
  }

  .search-input::placeholder,
  .replace-input::placeholder {
    color: var(--text-tertiary);
  }

  .search-area {
    width: 300px;
  }

  .replace-area {
    width: 300px;
  }

  .button-group {
    display: flex;
  }

  .spacer {
    width: 34px; /* Match close button width */
  }

  :global(.find-panel .close-btn) {
    font-size: 18px;
  }

</style>
