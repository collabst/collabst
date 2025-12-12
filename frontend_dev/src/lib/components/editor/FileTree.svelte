<script lang="ts">
  import FileTreeItem from './FileTreeItem.svelte'
  import { IconButton, Tooltip } from '$lib/components/ui'
  import File from '@lucide/svelte/icons/file'
  import Folder from '@lucide/svelte/icons/folder'
  import ArrowUpFromLine from '@lucide/svelte/icons/arrow-up-from-line'
  import type { File as ProjectFile, Asset } from '$lib/types'

  export let files: ProjectFile[]
  export let assets: Asset[]
  export let selectedItem: ProjectFile | Asset | null
  export let onSelectFile: (file: ProjectFile) => void
  export let onSelectAsset: (asset: Asset) => void
  export let onDeleteFile: ((fileId: number) => void) | null = null
  export let onDeleteAsset: ((assetId: number) => void) | null = null
  export let onCreateFile: (() => void) | null = null
  export let onCreateFolder: (() => void) | null = null
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
        <Tooltip text="New file" position="bottom">
          <IconButton 
            icon={File}
            onclick={onCreateFile}
            size="sm"
            variant="ghost"
          />
        </Tooltip>
      {/if}
      {#if onCreateFolder}
        <Tooltip text="New folder" position="bottom">
          <IconButton 
            icon={Folder}
            onclick={onCreateFolder}
            size="sm"
            variant="ghost"
          />
        </Tooltip>
      {/if}
      {#if onUploadAsset}
        <Tooltip text="Upload asset" position="bottom">
          <IconButton 
            icon={ArrowUpFromLine}
            onclick={onUploadAsset}
            size="sm"
            variant="ghost"
          />
        </Tooltip>
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
    background: var(--bg-file-panel);
    border-right: 1px solid var(--border-primary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tree-header {
    padding: var(--space-4);
    border-bottom: 1px solid var(--border-primary);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h3 {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }

  .tree-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .empty {
    padding: var(--space-8) var(--space-4);
    text-align: center;
    color: var(--text-tertiary);
    font-size: var(--text-sm);
  }
</style>
