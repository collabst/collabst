<script lang="ts">
  import { editorContext } from "$lib/components/editor/context/index";

  function handleFileClick(fileId: string) {
    editorContext.selectFile(fileId);
  };
</script>

<div class="files">
{#each $editorContext.files as file}
  <button onclick={() => {handleFileClick(file.id)}}>{file.path}</button>
{/each}
</div>

<style>
  .files {
    display: flex;
    flex-direction: column;
  }
</style>
