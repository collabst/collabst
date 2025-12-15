<script lang="ts">
  import type { File as ProjectFile, Asset } from '$lib/types'
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

  export let item: ProjectFile | Asset
  export let isSelected: boolean = false
  export let isPreview: boolean = false
  export let onSelect: () => void
  export let onSetPreview: (() => void) | undefined = undefined
  export let onDelete: (() => void) | null = null
  export let onRename: ((newName: string) => Promise<void>) | null = null
  export let usersViewing: { name: string; color: string }[] = []

  let isEditing = false
  let editingName = ''
  let inputElement: HTMLInputElement
  let isSubmitting = false

  function getFileIconComponent(item: ProjectFile | Asset) {
    // Check if it's an asset
    if ('mime_type' in item) {
      if (item.mime_type.startsWith('image/')) return Image
      if (item.mime_type.startsWith('video/')) return Video
      if (item.mime_type.startsWith('audio/')) return Music
      if (item.mime_type === 'application/pdf') return FileText
      return Paperclip
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
  on:click={onSelect}
  on:dblclick={handleDoubleClick}
  role="button"
  tabindex="0"
  on:keydown={(e) => e.key === 'Enter' && onSelect()}
>
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
  {#if onDelete}
    <button
      class="delete-btn"
      on:click|stopPropagation={onDelete}
      title="Delete"
    >
      ×
    </button>
  {/if}
</div>

<style>
  .file-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    transition: background 0.15s;
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
  }

  .name-input {
    flex: 1;
    background: var(--surface);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 13px;
    font-family: inherit;
    outline: none;
  }

  .name-input:focus {
    border-color: var(--primary);
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
    transition: color 0.15s;
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
    transition: opacity 0.15s;
  }

  .file-item:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    color: var(--color-error);
  }
</style>
