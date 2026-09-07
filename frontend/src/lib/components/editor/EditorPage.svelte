<script lang="ts">
  import TopBar from "$lib/components/ui/topBar/TopBar.svelte";
  import LeftPanel from "$lib/components/editor/leftPanel/LeftPanel.svelte";
  import EditorPanel from "$lib/components/editor/editorPanel/EditorPanel.svelte";
  import PreviewPanel from "$lib/components/editor/previewPanel/PreviewPanel.svelte";
  import SeparateWindow from "$lib/components/editor/previewPanel/SeparateWindow.svelte";
  import ResizeHandle from "$lib/components/editor/ResizeHandle.svelte";
  import CollapsedBar from "$lib/components/editor/leftPanel/CollapsedBar.svelte";
  import { separatePreviewOpen } from "$lib/components/editor/context";
  import {
    MIN_EDITOR_WIDTH,
    leftPanelVisible,
    setLeftPanelWidth,
    setPreviewWidth,
  } from "$lib/stores/layout";

  /**
   * Both handles resize the panel beside them and leave the other one alone:
   * the editor between them is elastic, so it is what gives and takes. Each
   * drag is therefore capped at the point where the editor would run out —
   * `startBefore + startAfter` is the width the two panels either side of the
   * handle have between them, and the editor is one of the two.
   */

  function resizeLeftPanel(
    deltaX: number,
    startBefore: number,
    startAfter: number,
  ) {
    setLeftPanelWidth(
      Math.min(startBefore + deltaX, startBefore + startAfter - MIN_EDITOR_WIDTH),
    );
  }

  function resizeEditorPreview(
    deltaX: number,
    startBefore: number,
    startAfter: number,
  ) {
    // Dragging right widens the editor at the preview's expense, so the delta
    // comes off the preview rather than onto it.
    setPreviewWidth(
      Math.min(startAfter - deltaX, startBefore + startAfter - MIN_EDITOR_WIDTH),
    );
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
    <!--
      Popped out, the preview owns its own window, so the split view gives the
      whole width back to the editor rather than holding an empty column. The
      way back is the top bar's split-view button.
    -->
    {#if !$separatePreviewOpen}
      <ResizeHandle
        onresize={resizeEditorPreview}
        ariaLabel="Resize the editor and preview"
      />
      <PreviewPanel />
    {/if}
  </div>
</div>

<SeparateWindow />

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
