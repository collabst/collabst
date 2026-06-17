<script lang="ts">
  import { leftPanelTab } from "$lib/components/editor/context/index";
  import Files from "./Files.svelte";
  import Search from "./Search.svelte";
  import Outline from "./Outline.svelte";
  import Issues from "./Issues.svelte";
  import Comments from "./Comments.svelte";
</script>

<div class="header">
  {#if $leftPanelTab === "files"}
  <Files />
  {:else if $leftPanelTab === "search"}
  <Search />
  {:else if $leftPanelTab === "outline"}
  <Outline />
  {:else if $leftPanelTab === "issues"}
  <Issues />
  {:else if $leftPanelTab === "comments"}
  <Comments />
  {/if}
</div>

<style>
  .header {
    width: 100%;
    font-size: 1.75rem;
    font-weight: bold;
    padding: 1.5rem 1.5rem;
    letter-spacing: -0.03em;
  }
</style>