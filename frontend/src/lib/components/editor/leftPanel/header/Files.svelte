<script lang="ts">
  import FilePlus from "@lucide/svelte/icons/file-plus";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import Button from "./Button.svelte";
  import { files, newFile, newFolder } from "$lib/components/editor/context";

  function handleNewFile() {
    newFile("newFile.typ");
  }

  function handleNewFolder() {
    newFolder("newFolder");
  }
</script>

<div class="files">
  <div class="name">Files</div>
  <div class="actions">
    <Button onclick={handleNewFile}>
      <FilePlus />
    </Button>
    <Button onclick={handleNewFolder}>
      <FolderPlus />
    </Button>
  </div>
</div>

<style>
  .files {
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
    gap: 0.5rem;
  }
</style>
