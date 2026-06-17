<script lang="ts">
  import Panel from "$lib/components/editor/Panel.svelte";
  import { previewIframe } from "$lib/components/editor/context";
  import ToolBar from "./toolbar/ToolBar.svelte";
</script>

<Panel>
  <div class="container">
    <ToolBar />
    <iframe
      bind:this={$previewIframe}
      id="preview-iframe"
      class="preview-iframe"
      title="Typst Preview"
      src="/typst-preview"
    >
    </iframe>
  </div>
</Panel>

<style>
  .container {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .preview-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
</style>
