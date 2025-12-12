<script lang="ts">
  import type { File as ProjectFile, Asset } from '$lib/types'

  export let item: ProjectFile | Asset
  export let isSelected: boolean = false
  export let onSelect: () => void
  export let onDelete: (() => void) | null = null

  function getFileIcon(item: ProjectFile | Asset): string {
    // Check if it's an asset
    if ('mime_type' in item) {
      if (item.mime_type.startsWith('image/')) return '🖼️'
      if (item.mime_type.startsWith('video/')) return '🎥'
      if (item.mime_type.startsWith('audio/')) return '🎵'
      if (item.mime_type === 'application/pdf') return '📄'
      return '📎'
    }

    // It's a file
    const name = item.name.toLowerCase()
    if (name.endsWith('.typ')) return '📝'
    if (name.endsWith('.md')) return '📖'
    if (name.endsWith('.txt')) return '📄'
    if (name.endsWith('.json')) return '{ }'
    if (name.endsWith('.js') || name.endsWith('.ts')) return '⚡'
    return '📄'
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
</script>

<div
  class="file-item"
  class:active={isSelected}
  class:asset={isAsset(item)}
  on:click={onSelect}
  role="button"
  tabindex="0"
  on:keydown={(e) => e.key === 'Enter' && onSelect()}
>
  <span class="icon">{getFileIcon(item)}</span>
  <div class="info">
    <span class="name">{getFileName(item)}</span>
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
    border-left: 3px solid transparent;
    transition: background 0.15s;
    color: var(--text-secondary);
  }

  .file-item:hover {
    background: var(--surface-hover);
  }

  .file-item.active {
    background: var(--surface-hover);
    color: var(--text-primary);
    border-left-color: var(--color-primary-600);
  }

  .file-item.asset {
    opacity: 0.9;
  }

  .icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .name {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .size {
    font-size: 11px;
    color: var(--text-tertiary);
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
