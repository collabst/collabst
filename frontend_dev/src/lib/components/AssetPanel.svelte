<script lang="ts">
  import type { Asset } from '../types'

  export let assets: Asset[]
  export let projectId: number
  export let onUpload: (file: File) => Promise<void>
  export let onDelete: (assetId: number) => Promise<void>
  export let onGetUrl: (assetId: number) => Promise<string>
  export let readOnly = false

  let isUploading = false
  let selectedAsset: Asset | null = null
  let previewUrl: string | null = null
  let fileInput: HTMLInputElement

  async function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    try {
      isUploading = true
      await onUpload(file)
      if (fileInput) {
        fileInput.value = ''
      }
    } catch (error) {
      console.error('Failed to upload asset:', error)
      alert('Failed to upload asset')
    } finally {
      isUploading = false
    }
  }

  async function handleAssetClick(asset: Asset) {
    selectedAsset = asset
    try {
      const url = await onGetUrl(asset.id)
      previewUrl = url
    } catch (error) {
      console.error('Failed to get asset URL:', error)
    }
  }

  async function handleDelete(assetId: number, e: Event) {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this asset?')) return

    try {
      await onDelete(assetId)
      if (selectedAsset?.id === assetId) {
        selectedAsset = null
        previewUrl = null
      }
    } catch (error) {
      console.error('Failed to delete asset:', error)
      alert('Failed to delete asset')
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.startsWith('video/')) return '🎥'
    if (mimeType.startsWith('audio/')) return '🎵'
    if (mimeType === 'application/pdf') return '📄'
    return '📎'
  }

  function isImage(mimeType: string) {
    return mimeType.startsWith('image/')
  }

  function isPdf(mimeType: string) {
    return mimeType === 'application/pdf'
  }

  function closePreview() {
    selectedAsset = null
    previewUrl = null
  }
</script>

<div class="container">
  <div class="header">
    <h3>Assets ({assets.length})</h3>
    {#if !readOnly}
      <input
        bind:this={fileInput}
        type="file"
        on:change={handleFileSelect}
        class="hidden-input"
        id="asset-upload"
      />
      <label for="asset-upload" class="upload-button">
        {isUploading ? '⏳' : '📤'}
      </label>
    {/if}
  </div>

  <div class="content">
    {#if assets.length === 0}
      <div class="empty">
        {readOnly ? 'No assets in this project.' : 'No assets yet. Upload images, PDFs, or other files.'}
      </div>
    {:else}
      <div class="asset-list">
        {#each assets as asset (asset.id)}
          <div
            class="asset-item"
            class:active={selectedAsset?.id === asset.id}
            on:click={() => handleAssetClick(asset)}
          >
            <div class="asset-icon">{getFileIcon(asset.mime_type)}</div>
            <div class="asset-info">
              <div class="asset-name">{asset.filename}</div>
              <div class="asset-meta">{formatFileSize(asset.size)}</div>
            </div>
            {#if !readOnly}
              <button
                on:click={(e) => handleDelete(asset.id, e)}
                class="delete-button"
                title="Delete asset"
              >
                🗑️
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if selectedAsset && previewUrl}
      <div class="preview">
        <div class="preview-header">
          <span>{selectedAsset.filename}</span>
          <button on:click={closePreview} class="close-preview">×</button>
        </div>
        <div class="preview-content">
          {#if isImage(selectedAsset.mime_type)}
            <img src={previewUrl} alt={selectedAsset.filename} class="preview-image" />
          {:else if isPdf(selectedAsset.mime_type)}
            <iframe src={previewUrl} title={selectedAsset.filename} class="preview-iframe" />
          {:else}
            <div class="preview-download">
              <p>Preview not available for this file type</p>
              <a href={previewUrl} download={selectedAsset.filename} class="download-link">
                Download {selectedAsset.filename}
              </a>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .container {
    width: 300px;
    background: #252526;
    border-left: 1px solid #3e3e42;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .header {
    padding: 1rem;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h3 {
    margin: 0;
    color: white;
    font-size: 14px;
    font-weight: 600;
  }

  .hidden-input {
    display: none;
  }

  .upload-button {
    background: #0e639c;
    color: white;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .empty {
    padding: 2rem 1rem;
    text-align: center;
    color: #888;
    font-size: 13px;
  }

  .asset-list {
    flex: 1;
    overflow: auto;
  }

  .asset-item {
    padding: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    border-bottom: 1px solid #3e3e42;
    color: #ccc;
  }

  .asset-item.active {
    background: #2a2d2e;
    border-left: 3px solid #0e639c;
  }

  .asset-item:hover {
    background: #2a2d2e;
  }

  .asset-icon {
    font-size: 24px;
  }

  .asset-info {
    flex: 1;
    min-width: 0;
  }

  .asset-name {
    font-size: 13px;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .asset-meta {
    font-size: 11px;
    color: #888;
  }

  .delete-button {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
    opacity: 0.6;
  }

  .delete-button:hover {
    opacity: 1;
  }

  .preview {
    border-top: 1px solid #3e3e42;
    max-height: 50%;
    display: flex;
    flex-direction: column;
  }

  .preview-header {
    padding: 0.75rem;
    background: #1e1e1e;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: white;
    font-size: 12px;
  }

  .close-preview {
    background: transparent;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
  }

  .preview-content {
    flex: 1;
    overflow: auto;
    background: #1e1e1e;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .preview-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  .preview-download {
    text-align: center;
    color: #888;
  }

  .download-link {
    color: #0e639c;
    text-decoration: none;
    display: block;
    margin-top: 1rem;
  }

  .download-link:hover {
    text-decoration: underline;
  }
</style>
