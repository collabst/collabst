<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import FileTreeItem from './FileTreeItem.svelte'
  import { IconButton, Tooltip } from '$lib/components/ui'
  import FilePlus from '@lucide/svelte/icons/file-plus'
  import FolderPlus from '@lucide/svelte/icons/folder-plus'
  import ArrowUpFromLine from '@lucide/svelte/icons/arrow-up-from-line'
  import type { File as ProjectFile, Asset, FileTreeNode } from '$lib/types'
  import type { WebsocketProvider } from 'y-websocket'
  import { buildFileTree, flattenTree } from '$lib/utils/fileTree'

  export let files: ProjectFile[]
  export let assets: Asset[]
  export let selectedItem: ProjectFile | Asset | null
  export let previewFileId: number | null = null
  export let onSelectFile: (file: ProjectFile) => void
  export let onSelectAsset: (asset: Asset) => void
  export let onSetPreviewFile: (fileId: number) => void
  export let onRenameFile: ((fileId: number, newName: string) => void) | null = null
  export let onRenameAsset: ((assetId: number, newName: string) => void) | null = null
  export let onMoveFile: ((fileId: number, targetFolderId: number | null) => void) | null = null
  export let onMoveAsset: ((assetId: number, targetFolderId: number | null) => void) | null = null
  export let onCreateFile: (() => void) | null = null
  export let onCreateFolder: (() => void) | null = null
  export let onUploadAsset: (() => void) | null = null
  export let onClearSelection: (() => void) | null = null
  export let provider: WebsocketProvider | null = null

  let awarenessStates: [number, any][] = []
  let expandedFolders = new Set<number>()
  let isRootDropZoneActive = false

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

  let fileTreeItems: any[] = []
  
  function handleTriggerRename() {
    // Find the selected item and trigger its rename
    const selectedElement = document.querySelector('.file-item.active')
    if (selectedElement) {
      // Trigger double-click event on the selected element
      const dblClickEvent = new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        view: window
      })
      selectedElement.dispatchEvent(dblClickEvent)
    }
  }
  
  onMount(() => {
    if (provider?.awareness) {
      provider.awareness.on('change', updateAwareness)
      updateAwareness()
    }
    
    // Listen for rename trigger events
    window.addEventListener('trigger-file-rename', handleTriggerRename)
  })

  onDestroy(() => {
    if (provider?.awareness) {
      provider.awareness.off('change', updateAwareness)
    }
    window.removeEventListener('trigger-file-rename', handleTriggerRename)
  })

  type TreeItem = (FileTreeNode | Asset) & { isAsset?: boolean }

  // Build hierarchical file tree and integrate assets
  $: fileTree = buildFileTree(files)

  // Insert assets into the tree structure based on their parent_id
  $: fileTreeWithAssets = (() => {
    const tree = JSON.parse(JSON.stringify(fileTree)) as FileTreeNode[] // Deep clone
    const fileMap = new Map<number, FileTreeNode>()

    // Build a map of all nodes for quick lookup
    const buildMap = (nodes: FileTreeNode[]) => {
      for (const node of nodes) {
        fileMap.set(node.id, node)
        if (node.children) {
          buildMap(node.children)
        }
      }
    }
    buildMap(tree)

    // Add assets to their parent folders or root
    for (const asset of assets) {
      const assetNode = {
        ...asset,
        name: asset.filename,
        path: asset.path || '',
        type: 'other' as const,
        content: '',
        is_folder: false,
        isAsset: true,
        children: [],
        level: 0,
        isExpanded: false
      }

      if (asset.parent_id === null) {
        // Root level asset
        tree.push(assetNode as any)
      } else {
        // Find parent and add as child
        const parent = fileMap.get(asset.parent_id)
        if (parent) {
          parent.children.push(assetNode as any)
          assetNode.level = parent.level + 1
        } else {
          // Parent not found, add to root
          tree.push(assetNode as any)
        }
      }
    }

    // Sort each level: folders first, then files/assets alphabetically
    const sortNodes = (nodes: any[]) => {
      nodes.sort((a, b) => {
        if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1
        const nameA = 'filename' in a ? a.filename : a.name
        const nameB = 'filename' in b ? b.filename : b.name
        return nameA.localeCompare(nameB)
      })
      nodes.forEach(n => {
        if (n.children) sortNodes(n.children)
      })
    }
    sortNodes(tree)

    return tree
  })()

  // Flatten tree for rendering, respecting collapsed state
  $: allItems = flattenTree(fileTreeWithAssets, expandedFolders).map(item => ({
    ...item,
    isAsset: 'mime_type' in item
  }))

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

  async function handleRename(item: TreeItem, newName: string) {
    if (item.isAsset && onRenameAsset) {
      await onRenameAsset(item.id, newName)
    } else if (!item.isAsset && onRenameFile) {
      await onRenameFile(item.id, newName)
    }
  }

  function handleToggleFolder(folderId: number) {
    if (expandedFolders.has(folderId)) {
      expandedFolders.delete(folderId)
    } else {
      expandedFolders.add(folderId)
    }
    expandedFolders = expandedFolders  // Trigger reactivity
  }

  function handleRootDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    isRootDropZoneActive = true
  }

  function handleRootDragLeave() {
    isRootDropZoneActive = false
  }

  function handleTreeContentClick(e: MouseEvent) {
    // Deselect when clicking on empty space to reset context to root
    // if (e.target === e.currentTarget && onClearSelection) {
    //  onClearSelection()
    //}
    pass
  }

  function handleRootDrop(e: DragEvent) {
    e.preventDefault()
    isRootDropZoneActive = false

    if (!e.dataTransfer) return

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))

      // Move file/folder/asset to root (parent_id = null)
      if (data.isAsset) {
        if (onMoveAsset) {
          onMoveAsset(data.id, null)
        }
      } else {
        if (onMoveFile) {
          onMoveFile(data.id, null)
        }
      }
    } catch (error) {
      console.error('Failed to parse drag data:', error)
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

  <div
    class="tree-content"
    class:root-drop-active={isRootDropZoneActive}
    on:dragover={handleRootDragOver}
    on:dragleave={handleRootDragLeave}
    on:drop={handleRootDrop}
    on:click={handleTreeContentClick}
    role="tree"
    tabindex="0"
  >
    {#if allItems.length === 0}
      <div class="empty">No files or assets yet</div>
    {:else}
      {#each allItems as item (`${item.isAsset ? 'asset' : 'file'}-${item.id}`)}
        {@const itemWithSelection = itemsWithSelection.find(i => i.item.id === item.id && i.item.isAsset === item.isAsset)}
        {#if itemWithSelection}
          <FileTreeItem
            item={itemWithSelection.item}
            isSelected={itemWithSelection.isSelected}
            usersViewing={itemWithSelection.usersViewing}
            isPreview={!item.isAsset && previewFileId === item.id}
            onSelect={() => handleSelect(item)}
            onSetPreview={!item.isAsset && !item.is_folder ? () => onSetPreviewFile(item.id) : undefined}
            onDelete={onDeleteFile || onDeleteAsset ? () => handleDelete(item) : null}
            onRename={onRenameFile || onRenameAsset ? (newName) => handleRename(item, newName) : null}
            onToggleFolder={!item.isAsset && item.is_folder ? () => handleToggleFolder(item.id) : undefined}
            onMoveFile={onMoveFile}
            onMoveAsset={onMoveAsset}
          />
        {/if}
      {/each}
    {/if}
  </div>
</div>

<style>
  .file-tree {
    width: 100%;
    height: 100%;
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

  .tree-content.root-drop-active {
    background: var(--primary-opacity-10);
    outline: 2px dashed var(--primary);
    outline-offset: -2px;
  }

  .empty {
    padding: var(--space-8) var(--space-4);
    text-align: center;
    color: var(--text-tertiary);
    font-size: var(--text-sm);
  }
</style>
