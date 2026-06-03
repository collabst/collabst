<script lang="ts">
  import { editorElement } from "../context";
</script>

<div bind:this={$editorElement} class="editor"></div>

<style>
  .editor {
    flex: 1;
    height: 100%;
    overflow: hidden;
  }

  :global(.cm-scroller) {
    padding-top: 3rem;
  }
</style>
