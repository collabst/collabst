<script lang="ts">
  import Panel from "$lib/components/editor/Panel.svelte";
  import { previewIframe } from "$lib/components/editor/context";
</script>

<Panel>
  <iframe
    bind:this={$previewIframe}
    id="preview-iframe"
    class="preview-iframe"
    title="Typst Preview"
    src="/typst-preview"
  >
  </iframe>
</Panel>

<style>
  .preview-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
</style>
