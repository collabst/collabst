<script lang="ts">
  import { files, selectFile } from "$lib/components/editor/context/index";

  function handleFileClick(fileId: string) {
    selectFile(fileId);
  };
</script>

<div class="files">
{#each $files as file}
  <button onclick={() => {handleFileClick(file.id)}}>{file.path}</button>
{/each}
</div>

<style>
  .files {
    display: flex;
    flex-direction: column;
  }
</style>
