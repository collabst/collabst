<script lang="ts">
  import { editorElement } from "../context";
</script>

<div bind:this={$editorElement} class="editor"></div>

<style>
  .editor {
    flex: 1;
    height: 100%;
    overflow: hidden;
    background-color: var(--bg-editor);
  }

  .editor :global(.cm-gutter) {
    background-color: var(--bg-editor);
  }

  .editor :global(.cm-gutters) {
    border: none;
  }

  .editor :global(.cm-scroller) {
    padding-top: 3rem;
  }

  :global([data-theme="dark"]) .editor :global(.cm-activeLine),
  :global([data-theme="dark"]) .editor :global(.cm-activeLineGutter) {
    background-color: #b0bac71a;
  }

  :global([data-theme="light"]) .editor :global(.cm-activeLine),
  :global([data-theme="light"]) .editor :global(.cm-activeLineGutter) {
    background-color: #06162f0b;
  }

  .editor :global(.cm-cursor) {
    border-left-color: var(--color-primary-500);
    border-left-width: 2px;
  }
</style>
