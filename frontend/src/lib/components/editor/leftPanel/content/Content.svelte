<script lang="ts">
  import { leftPanelTab } from "$lib/components/editor/context/index";
  import Files from "./Files.svelte";

  let tab = $derived($leftPanelTab);
</script>

{#if $leftPanelTab === "files"}
  <Files />
{:else if $leftPanelTab === "search"}
  <div>Search</div>
{:else if $leftPanelTab === "outline"}
  <div>Outline</div>
{:else if $leftPanelTab === "issues"}
  <div>Issues</div>
{:else if $leftPanelTab === "comments"}
  <div>Comments</div>
{/if}
