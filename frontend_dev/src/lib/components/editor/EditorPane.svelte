<script lang="ts">
  import CodeEditor from '$lib/components/CodeEditor.svelte'
  import type { File as ProjectFile, Asset } from '$lib/types'
  import type * as Y from 'yjs'
  import type { WebsocketProvider } from 'y-websocket'

  export let selectedFile: ProjectFile | null
  export let selectedAsset: Asset | null
  export let ytext: Y.Text | null
  export let provider: WebsocketProvider | null
  export let isConnected: boolean
  export let onGetAssetUrl: ((assetId: number) => Promise<string>) | null = null

  let assetPreviewUrl: string | null = null

  $: if (selectedAsset && onGetAssetUrl) {
    loadAssetPreview()
  } else {
    assetPreviewUrl = null
  }

  async function loadAssetPreview() {
    if (!selectedAsset || !onGetAssetUrl) return
    try {
      assetPreviewUrl = await onGetAssetUrl(selectedAsset.id)
    } catch (error) {
      console.error('Failed to load asset preview:', error)
      assetPreviewUrl = null
    }
  }

  function isImage(mimeType: string) {
    return mimeType.startsWith('image/')
  }

  function isPdf(mimeType: string) {
    return mimeType === 'application/pdf'
  }
</script>

<div class="editor-pane">
  {#if selectedFile && ytext && provider}
    <div class="editor-wrapper">
      <div class="editor-header">
        <div class="file-info">
          <span class="file-name">{selectedFile.name}</span>
          <span class="file-type">{selectedFile.type}</span>
        </div>
      </div>
      <div class="editor-content">
        <CodeEditor
          {ytext}
          {provider}
          fileId={selectedFile.id}
        />
      </div>
    </div>
  {:else if selectedAsset && assetPreviewUrl}
    <div class="asset-preview">
      <div class="editor-header">
        <div class="file-info">
          <span class="file-name">{selectedAsset.filename}</span>
          <span class="file-type">{selectedAsset.mime_type}</span>
        </div>
        <a href={assetPreviewUrl} download={selectedAsset.filename} class="download-btn">
          Download
        </a>
      </div>
      <div class="preview-content">
        {#if isImage(selectedAsset.mime_type)}
          <img src={assetPreviewUrl} alt={selectedAsset.filename} />
        {:else if isPdf(selectedAsset.mime_type)}
          <iframe src={assetPreviewUrl} title={selectedAsset.filename}></iframe>
        {:else}
          <div class="no-preview">
            <p>No preview available for this file type</p>
            <a href={assetPreviewUrl} download={selectedAsset.filename} class="download-link">
              Download {selectedAsset.filename}
            </a>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="no-selection">
      <p>{!isConnected ? 'Connecting...' : 'Select a file to start editing'}</p>
    </div>
  {/if}
</div>

<style>
  .editor-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .editor-wrapper,
  .asset-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .editor-header {
    background: #252526;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .file-name {
    color: white;
    font-size: 14px;
    font-weight: 600;
  }

  .file-type {
    color: #888;
    font-size: 12px;
    text-transform: uppercase;
  }

  .download-btn {
    background: #0e639c;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    text-decoration: none;
  }

  .download-btn:hover {
    background: #0a4d7a;
  }

  .editor-content {
    flex: 1;
    overflow: auto;
  }

  .preview-content {
    flex: 1;
    overflow: auto;
    background: #1e1e1e;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-content img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .preview-content iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  .no-preview {
    text-align: center;
    color: #888;
    padding: 2rem;
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

  .no-selection {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
    font-size: 16px;
  }
</style>
