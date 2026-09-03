<script lang="ts">
  import TopBar from "$lib/components/ui/topBar/TopBar.svelte";
  import LeftPanel from "$lib/components/editor/leftPanel/LeftPanel.svelte";
  import EditorPanel from "$lib/components/editor/editorPanel/EditorPanel.svelte";
  import PreviewPanel from "$lib/components/editor/previewPanel/PreviewPanel.svelte";
  import ResizeHandle from "$lib/components/editor/ResizeHandle.svelte";
  import CollapsedBar from "$lib/components/editor/leftPanel/CollapsedBar.svelte";
  import {
    leftPanelVisible,
    setEditorPreviewRatio,
    setLeftPanelWidth,
  } from "$lib/components/editor/context";

  function resizeLeftPanel(deltaX: number, startBefore: number) {
    setLeftPanelWidth(startBefore + deltaX);
  }

  function resizeEditorPreview(
    deltaX: number,
    startBefore: number,
    startAfter: number,
  ) {
    const total = startBefore + startAfter;
    if (total <= 0) return;
    setEditorPreviewRatio((startBefore + deltaX) / total);
  }
</script>

<div class="main">
  <TopBar />
  <div class="content">
    {#if $leftPanelVisible}
      <LeftPanel />
      <ResizeHandle onresize={resizeLeftPanel} ariaLabel="Resize the side panel" />
    {:else}
      <CollapsedBar />
    {/if}
    <EditorPanel />
    <ResizeHandle
      onresize={resizeEditorPreview}
      ariaLabel="Resize the editor and preview"
    />
    <PreviewPanel />
  </div>
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .content {
    min-height: 0; /* allow children to shrink inside this flex item */
    display: flex;
    flex-direction: row;
    flex: 1;
    --space: 0.2rem;
    gap: var(--space);
    padding: 0 var(--space) var(--space) var(--space);
  }
</style>
