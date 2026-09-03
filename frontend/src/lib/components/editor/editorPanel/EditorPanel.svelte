<script lang="ts">
  import Panel from "$lib/components/editor/Panel.svelte";
  import ToolBar from "$lib/components/editor/editorPanel/toolbar/ToolBar.svelte";
  import Editor from "$lib/components/editor/editorPanel/Editor.svelte";
  import Find from "$lib/components/editor/editorPanel/Find.svelte";
  import {
    editorPreviewRatio,
    findOpen,
    selectedAsset,
    showToolbar,
  } from "$lib/components/editor/context";
</script>

<Panel sizeWeight={$editorPreviewRatio}>
  <div class="container">
    <Editor />
    {#if !$selectedAsset}
      {#if $showToolbar}
        <ToolBar />
      {/if}
      {#if $findOpen}
        <Find />
      {/if}
    {/if}
  </div>
</Panel>

<style>
  .container {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
</style>
