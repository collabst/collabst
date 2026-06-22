<script lang="ts">
  import Button from "../Button.svelte";
  import ReplaceAll from "@lucide/svelte/icons/replace-all";
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
  <div>
    <div class="text">
      <span>{match.preMatchText}</span>
      <mark>{match.matchText}</mark>
      <span>{match.postMatchText}</span>
    </div>
    <div class="line">Line {match.startLine + 1}</div>
  </div>
  <Button onclick={() => replaceSearchMatch(match)}>
    <ReplaceAll />
  </Button>
</button>

<style>
  .match {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: transparent;
    border: none;
  }
</style>
