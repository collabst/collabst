<script lang="ts">
  import Button from "./Button.svelte";
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

  // Reverse the pre-match text because
  //   direction: rtl;
  //   unicode-bidi: bidi-override;
  // causes the text to be displayed in reverse order, but spaces are concistent
  let preMatchText = $derived(match.preMatchText.split('').reverse().join(''));
</script>

<button
  class="match"
  onclick={() => {
    gotoSearchMatch(match);
  }}
>
  <div class="text">
    <div class="pre-match">{preMatchText}</div>
    <div class="match-text">{match.matchText}</div>
    <div class="post-match">{match.postMatchText}</div>
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

  .text {
    display: flex;
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .pre-match {
    flex: 1 1 0;
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: right;
    direction: rtl;
    unicode-bidi: bidi-override;
  }

  .post-match {
    flex: 1 1 0;
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    direction: ltr;
  }

  .match-text {
    white-space: pre;
    flex: 0 0 auto;
    background-color: yellow;
  }

  .match:active:not(:has(.button:active)) .text,
  .match:active:not(:has(.button:active)) .line {
    transform: translateY(2px);
  }

  .right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .line {
    margin-left: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-tertiary);
  }
</style>
