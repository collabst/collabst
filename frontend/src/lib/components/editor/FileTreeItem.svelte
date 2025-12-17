<script lang="ts">
  import type { File as ProjectFile, Asset, FileTreeNode } from '$lib/types'
  import { Tooltip } from '$lib/components/ui'
  import File from '@lucide/svelte/icons/file'
  import FileText from '@lucide/svelte/icons/file-text'
  import Image from '@lucide/svelte/icons/image'
  import BookOpen from '@lucide/svelte/icons/book-open'
  import Video from '@lucide/svelte/icons/video'
  import Music from '@lucide/svelte/icons/music'
  import Paperclip from '@lucide/svelte/icons/paperclip'
  import Eye from '@lucide/svelte/icons/eye'
  import EyeOff from '@lucide/svelte/icons/eye-closed'
  import Folder from '@lucide/svelte/icons/folder'
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'

  export let item: (ProjectFile & FileTreeNode) | Asset
  export let isSelected: boolean = false
  export let isPreview: boolean = false
  export let onSelect: () => void
  export let onSetPreview: (() => void) | undefined = undefined
  export let onRename: ((newName: string) => Promise<void>) | null = null
  export let onToggleFolder: (() => void) | undefined = undefined
  export let onMoveFile: ((fileId: number, targetFolderId: number | null) => void) | undefined = undefined
  export let onMoveAsset: ((assetId: number, targetFolderId: number | null) => void) | undefined = undefined
  export let usersViewing: { name: string; color: string }[] = []

  let isEditing = false
  let editingName = ''
  let inputElement: HTMLInputElement
  let isSubmitting = false
  let isDragOver = false

  function handleDragStart(e: DragEvent) {
    if (!e.dataTransfer) return

    // Store the item being dragged
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: item.id,
      isAsset: isAsset(item),
      isFolder: 'is_folder' in item && item.is_folder
    }))

    // Add dragging class
    if (e.target instanceof HTMLElement) {
      e.target.classList.add('dragging')
    }
  }

  function handleDragEnd(e: DragEvent) {
    if (e.target instanceof HTMLElement) {
      e.target.classList.remove('dragging')
    }
    isDragOver = false
  }

  function handleDragOver(e: DragEvent) {
    // Allow drop on any item (folders, files, or assets)
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    isDragOver = true
  }

  function handleDragLeave() {
    isDragOver = false
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation() // Stop event from bubbling to parent
    isDragOver = false

    if (!e.dataTransfer) return

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))

      // Don't allow dropping onto self
      if (data.id === item.id && data.isAsset === isAsset(item)) return

      // Determine target parent:
      // - If dropping on a folder: use the folder's id
      // - If dropping on a file/asset: use the same parent (item.parent_id)
      let targetParentId: number | null
      if ('is_folder' in item && item.is_folder) {
        targetParentId = item.id
      } else {
        targetParentId = 'parent_id' in item ? item.parent_id : null
      }

      // Move the file/folder/asset to the target parent
      if (data.isAsset) {
        if (onMoveAsset) {
          onMoveAsset(data.id, targetParentId)
        }
      } else {
        if (onMoveFile) {
          onMoveFile(data.id, targetParentId)
        }
      }
    } catch (error) {
      console.error('Failed to parse drag data:', error)
    }
  }

  function getFileIconComponent(item: (ProjectFile & FileTreeNode) | Asset) {
    // Check if it's an asset
    if ('mime_type' in item) {
      if (item.mime_type.startsWith('image/')) return Image
      if (item.mime_type.startsWith('video/')) return Video
      if (item.mime_type.startsWith('audio/')) return Music
      if (item.mime_type === 'application/pdf') return FileText
      return Paperclip
    }

    // Check if it's a folder
    if ('is_folder' in item && item.is_folder) {
      return ('isExpanded' in item && item.isExpanded) ? FolderOpen : Folder
    }

    // It's a file - check extension
    const name = item.name.toLowerCase()
    if (name.endsWith('.bib')) return BookOpen
    if (name.endsWith('.pdf')) return FileText
    if (name.endsWith('.svg') || name.endsWith('.png') || name.endsWith('.jpg') ||
        name.endsWith('.jpeg') || name.endsWith('.gif') || name.endsWith('.webp')) return Image
    return File
  }

  function getFileName(item: ProjectFile | Asset): string {
    return 'filename' in item ? item.filename : item.name
  }

  function getFileSize(item: ProjectFile | Asset): string | null {
    if ('size' in item) {
      const bytes = item.size
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }
    return null
  }

  function isAsset(item: ProjectFile | Asset): item is Asset {
    return 'mime_type' in item
  }

  function isTypstFile(item: ProjectFile | Asset): boolean {
    if (isAsset(item)) return false
    const name = item.name.toLowerCase()
    return name.endsWith('.typ')
  }

  function handleDoubleClick() {
    if (onRename) {
      isEditing = true
      editingName = getFileName(item)
      setTimeout(() => {
        if (inputElement) {
          inputElement.focus()
          // Select only the filename without extension
          const lastDotIndex = editingName.lastIndexOf('.')
          if (lastDotIndex > 0) {
            // Select from start to before the extension
            inputElement.setSelectionRange(0, lastDotIndex)
          } else {
            // No extension, select all
            inputElement.select()
          }
        }
      }, 0)
    }
  }

  async function handleRenameSubmit() {
    if (isSubmitting) return
    
    const trimmedName = editingName.trim()
    const currentName = getFileName(item)
    
    // If no changes, just close the editor
    if (!trimmedName || trimmedName === currentName) {
      isEditing = false
      isSubmitting = false
      return
    }
    
    isSubmitting = true
    
    try {
      if (onRename) {
        await onRename(trimmedName)
      }
      isEditing = false
    } catch (error) {
      console.error('Failed to rename:', error)
      // Keep editing mode open on error so user can try again
    } finally {
      isSubmitting = false
    }
  }

  function handleRenameCancel() {
    isEditing = false
    editingName = ''
    isSubmitting = false
  }

  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleRenameCancel()
    }
  }
</script>

<div
  class="file-item"
  class:active={isSelected}
  class:asset={isAsset(item)}
  class:folder={'is_folder' in item && item.is_folder}
  class:drag-over={isDragOver}
  style="padding-left: {'level' in item ? `${item.level * 1.5 + 0.5}rem` : '0.5rem'}"
  draggable={!isEditing}
  on:dragstart={handleDragStart}
  on:dragend={handleDragEnd}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  on:click={() => {
    // If it's a folder and has toggle handler, just toggle
    if ('is_folder' in item && item.is_folder && onToggleFolder) {
      onToggleFolder()
    } else {
      // Otherwise select the file/asset
      onSelect()
    }
  }}
  on:dblclick={handleDoubleClick}
  role="button"
  tabindex="0"
  on:keydown={(e) => {
    if (e.key === 'Enter') {
      if ('is_folder' in item && item.is_folder && onToggleFolder) {
        onToggleFolder()
      } else {
        onSelect()
      }
    }
  }}
>
  {#if 'is_folder' in item && item.is_folder && onToggleFolder}
    <button
      class="chevron"
      on:click|stopPropagation={onToggleFolder}
      title={item.isExpanded ? "Collapse folder" : "Expand folder"}
    >
      <svelte:component this={item.isExpanded ? ChevronDown : ChevronRight} size={16} />
    </button>
  {:else}
    <span class="chevron-spacer" />
  {/if}
  <span class="icon">
    <svelte:component this={getFileIconComponent(item)} size={16} />
  </span>
  <div class="info">
    <div class="name-row">
      {#if isEditing}
        <input
          bind:this={inputElement}
          bind:value={editingName}
          on:blur={handleRenameCancel}
          on:keydown={handleRenameKeydown}
          class="name-input"
          type="text"
          on:click|stopPropagation
        />
      {:else}
        <span class="name">{getFileName(item)}</span>
      {/if}
      {#if usersViewing.length > 0}
        <div class="user-indicators">
          {#each usersViewing as user}
            <div
              class="user-dot"
              style="background-color: {user.color}"
              title="{user.name} is viewing"
            />
          {/each}
        </div>
      {/if}
      {#if isTypstFile(item) && onSetPreview}
        <Tooltip text={isPreview ? "Preview enabled" : "Preview this file"}>
          <button
            class="preview-btn"
            on:click|stopPropagation={onSetPreview}
          >
            <svelte:component this={isPreview ? Eye : EyeOff} size={16} />
          </button>
        </Tooltip>
      {/if}
    </div>
    {#if getFileSize(item)}
      <span class="size">{getFileSize(item)}</span>
    {/if}
  </div>
</div>

<style>
  .file-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    color: var(--text-primary);
  }

  .file-item:hover {
    background: var(--surface-hover);
  }

  .file-item.active {
    background: var(--surface-hover);
  }

  .file-item.asset {
    opacity: 0.9;
  }

  .file-item.folder {
    font-weight: var(--font-medium);
  }

  .file-item[draggable="true"] {
    cursor: grab;
  }

  .file-item[draggable="true"]:active {
    cursor: grabbing;
  }

  .file-item:global(.dragging) {
    opacity: 0.5;
  }

  .file-item.drag-over {
    background: var(--primary-opacity-10);
    outline: 2px solid var(--primary);
    outline-offset: -2px;
    border-radius: var(--radius-sm);
  }

  .chevron {
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-sm);
  }

  .chevron:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .chevron-spacer {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    color: inherit;
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .name {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
    padding: 2px 6px;
    margin: 0;
  }

  .name-input {
    flex: 1;
    min-width: 0;
    max-width: 100%;
    background: var(--surface);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    margin: 0;
  }

  .name-input:focus {
    border-color: var(--color-primary-500);
    outline: 2px solid var(--color-primary-500);
    outline-offset: 0px;
  }

  .user-indicators {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .user-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .size {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .preview-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
  }

  .preview-btn:hover {
    color: var(--text-primary);
    background: var(--surface-hover);
  }

  .delete-btn {
    background: transparent;
    border: none;
    color: var(--text-tertiary);
    font-size: 20px;
    cursor: pointer;
    padding: 0 0.25rem;
    opacity: 0;
  }

  .file-item:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    color: var(--color-error);
  }
</style>
