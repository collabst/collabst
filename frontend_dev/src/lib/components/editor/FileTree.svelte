<script lang="ts">
  import FileTreeItem from './FileTreeItem.svelte'
  import type { File as ProjectFile, Asset } from '$lib/types'

  export let files: ProjectFile[]
  export let assets: Asset[]
  export let selectedItem: ProjectFile | Asset | null
  export let onSelectFile: (file: ProjectFile) => void
  export let onSelectAsset: (asset: Asset) => void
  export let onDeleteFile: ((fileId: number) => void) | null = null
  export let onDeleteAsset: ((assetId: number) => void) | null = null
  export let onCreateFile: (() => void) | null = null
  export let onUploadAsset: (() => void) | null = null

  type TreeItem = (ProjectFile | Asset) & { isAsset?: boolean }

  $: allItems = [
    ...files.map(f => ({ ...f, isAsset: false })),
    ...assets.map(a => ({ ...a, isAsset: true }))
  ].sort((a, b) => {
    // Sort: files first, then assets, alphabetically within each group
    if (a.isAsset === b.isAsset) {
      const nameA = 'filename' in a ? a.filename : a.name
      const nameB = 'filename' in b ? b.filename : b.name
      return nameA.localeCompare(nameB)
    }
    return a.isAsset ? 1 : -1
  })

  // Make the selection map reactive
  $: selectedId = selectedItem?.id
  $: selectedIsAsset = selectedItem ? 'filename' in selectedItem : false

  // Create a reactive map of which items are selected
  $: itemsWithSelection = allItems.map(item => ({
    item,
    isSelected: selectedId ? (item.id === selectedId && item.isAsset === selectedIsAsset) : false
  }))

  function handleSelect(item: TreeItem) {
    if (item.isAsset) {
      onSelectAsset(item as Asset)
    } else {
      onSelectFile(item as ProjectFile)
    }
  }

  function handleDelete(item: TreeItem) {
    if (item.isAsset && onDeleteAsset) {
      onDeleteAsset(item.id)
    } else if (!item.isAsset && onDeleteFile) {
      onDeleteFile(item.id)
    }
  }
</script>

<div class="file-tree">
  <div class="tree-header">
    <h3>Files</h3>
    <div class="actions">
      {#if onCreateFile}
        <button on:click={onCreateFile} class="action-btn" title="New file">
          📄+
        </button>
      {/if}
      {#if onUploadAsset}
        <button on:click={onUploadAsset} class="action-btn" title="Upload asset">
          📎+
        </button>
      {/if}
    </div>
  </div>

  <div class="tree-content">
    {#if itemsWithSelection.length === 0}
      <div class="empty">No files or assets yet</div>
    {:else}
      {#each itemsWithSelection as {item, isSelected} (`${item.isAsset ? 'asset' : 'file'}-${item.id}`)}
        <FileTreeItem
          {item}
          {isSelected}
          onSelect={() => handleSelect(item)}
          onDelete={onDeleteFile || onDeleteAsset ? () => handleDelete(item) : null}
        />
      {/each}
    {/if}
  </div>
</div>

<style>
  .file-tree {
    width: 280px;
    background: #252526;
    border-right: 1px solid #3e3e42;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tree-header {
    padding: 1rem;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: white;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    background: #0e639c;
    color: white;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .action-btn:hover {
    background: #0a4d7a;
  }

  .tree-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .tree-content::-webkit-scrollbar {
    width: 8px;
  }

  .tree-content::-webkit-scrollbar-track {
    background: #1e1e1e;
  }

  .tree-content::-webkit-scrollbar-thumb {
    background: #3e3e42;
    border-radius: 4px;
  }

  .tree-content::-webkit-scrollbar-thumb:hover {
    background: #4e4e52;
  }

  .empty {
    padding: 2rem 1rem;
    text-align: center;
    color: #888;
    font-size: 13px;
  }
</style>
