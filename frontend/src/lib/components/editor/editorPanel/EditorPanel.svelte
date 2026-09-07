<script lang="ts">
  import Panel from "$lib/components/editor/Panel.svelte";
  import ToolBar from "$lib/components/editor/editorPanel/toolbar/ToolBar.svelte";
  import Editor from "$lib/components/editor/editorPanel/Editor.svelte";
  import Find from "$lib/components/editor/editorPanel/Find.svelte";
  import { findOpen, selectedAsset } from "$lib/components/editor/context";
  import { MIN_EDITOR_WIDTH } from "$lib/stores/layout";
  import { showToolbar } from "$lib/stores/preferences";
</script>

<!--
  The row's elastic column: it takes whatever the side panel and the preview
  leave, so it is the one that moves when either handle is dragged, and it is
  the whole width when the preview is popped out.
-->
<Panel minWidth={MIN_EDITOR_WIDTH}>
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
