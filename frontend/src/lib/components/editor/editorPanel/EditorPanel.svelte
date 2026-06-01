<script lang="ts">
  import Panel from "$lib/components/editor/Panel.svelte";
  import ToolBar from "$lib/components/editor/editorPanel/toolbar/ToolBar.svelte";
  import Editor from "$lib/components/editor/editorPanel/Editor.svelte";
  import { editorContext } from "$lib/components/editor/context";
</script>

<Panel>
  <div class="container">
    <Editor
      fileId={$editorContext.fileId}
      fileName={$editorContext.fileName}
      ytext={$editorContext.ytext}
      ydoc={$editorContext.ydoc}
      provider={$editorContext.provider}
      diagnostics={$editorContext.diagnostics}
      wrapLines={$editorContext.wrapLines}
      editable={$editorContext.editable}
      theme={$editorContext.theme}
    />
    <ToolBar />
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
