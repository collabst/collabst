<script lang="ts">
  import { leftPanelTab } from "$lib/components/editor/context/index";
  import Comments from "./comments/Comments.svelte";
  import Files from "./files/Files.svelte";
  import Issues from "./issues/Issues.svelte";
  import Outline from "./outline/Outline.svelte";
  import Search from "./search/Search.svelte";
</script>

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
