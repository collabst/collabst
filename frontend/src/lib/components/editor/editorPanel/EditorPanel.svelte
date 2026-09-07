<script lang="ts">
  import Panel from "$lib/components/editor/Panel.svelte";
  import ToolBar from "$lib/components/editor/editorPanel/toolbar/ToolBar.svelte";
  import Editor from "$lib/components/editor/editorPanel/Editor.svelte";
  import Find from "$lib/components/editor/editorPanel/Find.svelte";
  import { findOpen, selectedAsset } from "$lib/components/editor/context";
  import { editorPreviewRatio } from "$lib/stores/layout";
  import { showToolbar } from "$lib/stores/preferences";
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
