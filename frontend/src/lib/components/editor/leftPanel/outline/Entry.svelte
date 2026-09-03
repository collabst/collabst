<script lang="ts">
  import {
    gotoOutlineEntry,
    type OutlineEntry,
  } from "$lib/components/editor/context";

  interface Props {
    entry: OutlineEntry;
  }
  let { entry }: Props = $props();
</script>

<button
  class="entry"
  style="--level: {entry.level - 1};"
  onclick={() => gotoOutlineEntry(entry)}
>
  <span class="title">{entry.title}</span>
  <span class="line">{entry.line}</span>
</button>

<style>
  .entry {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    margin: 0 1rem;
    padding: 0.3rem 1rem;
    padding-left: calc(1rem + var(--level) * 0.85rem);
    border: 1px solid transparent;
    border-bottom: 3px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font: inherit;
    text-align: left;
    cursor: pointer;
    box-sizing: border-box;
  }

  .entry:hover {
    background-color: var(--surface-hover);
  }

  .entry:active .title {
    transform: translateY(2px);
  }

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: calc(700 - var(--level) * 100);
  }

  .line {
    flex-shrink: 0;
    font-size: 0.7rem;
    color: var(--text-tertiary);
  }
</style>
