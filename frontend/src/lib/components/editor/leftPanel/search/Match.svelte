<script lang="ts">
  import Button from "../Button.svelte";
  import Replace from "@lucide/svelte/icons/replace";
  import {
    type SearchMatch,
    gotoSearchMatch,
    replaceSearchMatch,
  } from "$lib/components/editor/context";

  interface Props {
    match: SearchMatch;
  }

  let { match }: Props = $props();
</script>

<button
  class="match"
  onclick={() => {
    gotoSearchMatch(match);
  }}
>
  <div class="text">
    <span>{match.preMatchText}</span>
    <mark>{match.matchText}</mark>
    <span>{match.postMatchText}</span>
  </div>
  <div class="right">
    <div class="line">Line {match.startLine + 1}</div>
    <Button onclick={(e) => {
      e.stopPropagation();
      replaceSearchMatch(match);
    }}>
      <Replace />
    </Button>
  </div>
</button>

<style>
  .match {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 0.1rem var(--space-3);
    color: var(--text-secondary);
    width: 100%;
  }

  .match:hover {
    background-color: var(--surface-hover);
  }

  .match:active .text, .match:active .line {
    transform: translateY(2px);
  }

  .right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .line {
    font-size: 0.8rem;
    color: var(--text-tertiary);
  }
</style>
