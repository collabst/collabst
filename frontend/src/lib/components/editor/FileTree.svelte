<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import FileTreeItem from './FileTreeItem.svelte'
  import { IconButton, Tooltip } from '$lib/components/ui'
  import FilePlus from '@lucide/svelte/icons/file-plus'
  import FolderPlus from '@lucide/svelte/icons/folder-plus'
  import ArrowUpFromLine from '@lucide/svelte/icons/arrow-up-from-line'
  import type { File as ProjectFile, Asset } from '$lib/types'
  import type { WebsocketProvider } from 'y-websocket'

  export let files: ProjectFile[]
  export let assets: Asset[]
  export let selectedItem: ProjectFile | Asset | null
  export let previewFileId: number | null = null
  export let onSelectFile: (file: ProjectFile) => void
  export let onSelectAsset: (asset: Asset) => void
  export let onSetPreviewFile: (fileId: number) => void
  export let onDeleteFile: ((fileId: number) => void) | null = null
  export let onDeleteAsset: ((assetId: number) => void) | null = null
  export let onRenameFile: ((fileId: number, newName: string) => void) | null = null
  export let onRenameAsset: ((assetId: number, newName: string) => void) | null = null
  export let onCreateFile: (() => void) | null = null
  export let onCreateFolder: (() => void) | null = null
  export let onUploadAsset: (() => void) | null = null
  export let provider: WebsocketProvider | null = null

  let awarenessStates: [number, any][] = []

  function updateAwareness() {
    if (provider?.awareness) {
      awarenessStates = Array.from(provider.awareness.getStates().entries())
    } else {
      awarenessStates = []
    }
  }

  $: if (provider) {
    updateAwareness()
  }

  onMount(() => {
    if (provider?.awareness) {
      provider.awareness.on('change', updateAwareness)
      updateAwareness()
    }
  })

  onDestroy(() => {
    if (provider?.awareness) {
      provider.awareness.off('change', updateAwareness)
    }
  })

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

  // Create a reactive map of which items are selected and which users are viewing them
  $: itemsWithSelection = allItems.map(item => {
    const isSelected = selectedId ? (item.id === selectedId && item.isAsset === selectedIsAsset) : false

    // Find users viewing this item (file or asset, excluding the local user)
    const usersViewing = awarenessStates
      .filter(([clientId, state]) => {
        // Exclude local user and check if they're viewing this item
        return (
          state.user?.name &&
          clientId !== provider?.awareness?.clientID &&
          state.currentItem?.id === item.id &&
          state.currentItem?.isAsset === item.isAsset
        )
      })
      .map(([_, state]) => ({
        name: state.user?.name,
        color: state.user?.color || '#999'
      }))

    return {
      item,
      isSelected,
      usersViewing
    }
  })

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

  function handleRename(item: TreeItem, newName: string) {
    if (item.isAsset && onRenameAsset) {
      onRenameAsset(item.id, newName)
    } else if (!item.isAsset && onRenameFile) {
      onRenameFile(item.id, newName)
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
            icon={FilePlus}
            onclick={onCreateFile}
            size="sm"
            variant="ghost"
          />
        </Tooltip>
      {/if}
      {#if onCreateFolder}
        <Tooltip text="New folder" position="bottom">
          <IconButton 
            icon={FolderPlus}
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
      {#each itemsWithSelection as {item, isSelected, usersViewing} (`${item.isAsset ? 'asset' : 'file'}-${item.id}`)}
        <FileTreeItem
          {item}
          {isSelected}
          {usersViewing}
          isPreview={!item.isAsset && previewFileId === item.id}
          onSelect={() => handleSelect(item)}
          onSetPreview={!item.isAsset ? () => onSetPreviewFile(item.id) : undefined}
          onDelete={onDeleteFile || onDeleteAsset ? () => handleDelete(item) : null}
          onRename={onRenameFile || onRenameAsset ? (newName) => handleRename(item, newName) : null}
        />
      {/each}
    {/if}
  </div>
</div>

<style>
  .file-tree {
    width: 280px;
    background: var(--bg-file-panel);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 8px;
    margin: 0 0 var(--space-3) 0;
    padding-right: 0;
  }

  .tree-header {
    padding: var(--space-4);
    padding-right: var(--space-4);
    border-bottom: 1px solid var(--border-primary);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .tree-header :global(.icon-btn-ghost) {
    background: var(--bg-top-bar) !important;
  }

  .tree-header :global(.icon-btn-ghost:hover) {
    background: var(--surface-hover) !important;
  }

  h3 {
    margin: 0;
    font-size: var(--text-base);
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
