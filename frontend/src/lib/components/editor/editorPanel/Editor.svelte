<script lang="ts">
  import { onMount } from "svelte";
  import { editorContext } from "../context";

  onMount(() => {
    editorContext.initView();
  });
</script>

<div bind:this={$editorContext.editorElement} class="editor"></div>

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
