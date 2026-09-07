<script lang="ts">
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import FilePlus from "@lucide/svelte/icons/file-plus";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import Upload from "@lucide/svelte/icons/upload";
  import Button from "../Button.svelte";
  import OverflowBar, {
    type OverflowItem,
  } from "$lib/components/ui/OverflowBar.svelte";
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

  // The title takes what it needs; a panel dragged narrow folds the actions the
  // title leaves no room for into the menu.
  const actions: OverflowItem[] = $derived([
    { render: newFileAction, label: "New file" },
    { render: newFolderAction, label: "New folder" },
    { render: uploadAction, label: "Upload files" },
  ]);
</script>

{#snippet newFileAction()}
  <Button onclick={handleNewFile} disabled={!$canWrite} title="New file">
    <FilePlus />
  </Button>
{/snippet}

{#snippet newFolderAction()}
  <Button onclick={handleNewFolder} disabled={!$canWrite} title="New folder">
    <FolderPlus />
  </Button>
{/snippet}

{#snippet uploadAction()}
  <Button onclick={handleUploadClick} disabled={!$canWrite} title="Upload files">
    <Upload />
  </Button>
{/snippet}

{#snippet more({ onclick }: { onclick: (e: MouseEvent) => void })}
  <Button {onclick} title="More actions">
    <Ellipsis />
  </Button>
{/snippet}

<div class="header">
  <div class="name">Files</div>
  <OverflowBar class="files-actions" items={actions} {more} />
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

  /* `OverflowBar` owns the element; see the note on `.nav-bar`. */
  :global(.overflow-bar.files-actions) {
    gap: 0.25rem;
  }
</style>
