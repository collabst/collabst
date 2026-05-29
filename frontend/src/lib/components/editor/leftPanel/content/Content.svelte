<script lang="ts">
  import { editorContext } from "$lib/components/editor/context/index";
  import Files from "./Files.svelte";

  let tab = $derived($editorContext.leftPanelTab);
</script>

{#if $editorContext.leftPanelTab === "files"}
  <Files />
{:else if $editorContext.leftPanelTab === "search"}
  <div>Search</div>
{:else if $editorContext.leftPanelTab === "outline"}
  <div>Outline</div>
{:else if $editorContext.leftPanelTab === "issues"}
  <div>Issues</div>
{:else if $editorContext.leftPanelTab === "comments"}
  <div>Comments</div>
{/if}
