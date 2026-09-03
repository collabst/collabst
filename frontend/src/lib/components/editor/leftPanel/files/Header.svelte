<script lang="ts">
  import FilePlus from "@lucide/svelte/icons/file-plus";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import Upload from "@lucide/svelte/icons/upload";
  import Button from "../Button.svelte";
  import {
    canWrite,
    newFile,
    newFolder,
    uploadAssets,
  } from "$lib/components/editor/context";

  let uploadInput: HTMLInputElement | undefined = $state();

  function handleNewFile() {
    newFile("newFile.typ");
  }

  function handleNewFolder() {
    newFolder("newFolder");
  }

  function handleUploadClick() {
    uploadInput?.click();
  }

  function handleUploadChange() {
    if (!uploadInput?.files) return;
    uploadAssets(Array.from(uploadInput.files), null);
    // Cleared so picking the same file twice in a row still fires `change`.
    uploadInput.value = "";
  }
</script>

<div class="header">
  <div class="name">Files</div>
  <div class="actions">
    <Button onclick={handleNewFile} disabled={!$canWrite} title="New file">
      <FilePlus />
    </Button>
    <Button onclick={handleNewFolder} disabled={!$canWrite} title="New folder">
      <FolderPlus />
    </Button>
    <Button
      onclick={handleUploadClick}
      disabled={!$canWrite}
      title="Upload files"
    >
      <Upload />
    </Button>
  </div>
</div>

<input
  bind:this={uploadInput}
  type="file"
  multiple
  hidden
  onchange={handleUploadChange}
/>

<style>
  .header {
    width: 100%;
    padding: 1.5rem 1.5rem calc(1.5rem - 3px);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .name {
    font-size: 1.75rem;
    font-weight: bold;
    letter-spacing: -0.03em;
  }

  .actions {
    display: flex;
    gap: 0.25rem;
  }
</style>
