<script lang="ts">
  import TopBar from "$lib/components/ui/topBar/TopBar.svelte";
  import LeftPanel from "$lib/components/editor/leftPanel/LeftPanel.svelte";
  import EditorPanel from "$lib/components/editor/editorPanel/EditorPanel.svelte";
  import PreviewPanel from "$lib/components/editor/PreviewPanel.svelte";
</script>

<div class="main">
  <TopBar />
  <div class="content">
    <LeftPanel />
    <EditorPanel />
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
    --space: 0.5rem;
    gap: var(--space);
    padding: 0 var(--space) var(--space) var(--space);
  }
</style>
