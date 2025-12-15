<script lang="ts">
  import Hand from '@lucide/svelte/icons/hand'
  
  interface UploadAssetModalProps {
    show: boolean
    onClose: () => void
    onUpload: (file: File) => void
  }

  let { show, onClose, onUpload }: UploadAssetModalProps = $props()

  let fileInput: HTMLInputElement
  let selectedFile: File | null = $state(null)
  let isDragging = $state(false)

  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement
    selectedFile = target.files?.[0] || null
    console.log('Selected file:', selectedFile)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    isDragging = false
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      selectedFile = files[0]
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    isDragging = true
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault()
    isDragging = false
  }

  function handleSubmit(e: Event) {
    e.preventDefault()
    if (selectedFile) {
      onUpload(selectedFile)
      selectedFile = null
      if (fileInput) fileInput.value = ''
    }
  }

  function handleBackdropClick() {
    onClose()
  }

  function openFilePicker() {
    fileInput?.click()
  }
</script>

{#if show}
  <div class="modal" on:click={handleBackdropClick} role="dialog" aria-modal="true">
    <div class="modal-content" on:click|stopPropagation role="document">
      <h2>Upload Asset</h2>
      <form on:submit={handleSubmit}>
        <input
          bind:this={fileInput}
          type="file"
          on:change={handleFileSelect}
          style="display: none;"
        />
        
        <div 
          class="drop-zone"
          class:dragging={isDragging}
          on:click={openFilePicker}
          on:drop={handleDrop}
          on:dragover={handleDragOver}
          on:dragleave={handleDragLeave}
          role="button"
          tabindex="0"
        >
          <Hand size={64} strokeWidth={1.5} />
          <p class="drop-text">Click or drag and drop files here to upload them</p>
        </div>

        {#if selectedFile}
          <p class="file-info">Selected: {selectedFile.name}</p>
        {/if}

        <div class="modal-actions">
          <button type="button" on:click={onClose} class="cancel-btn">
            Cancel
          </button>
          <button type="submit" class="submit-btn" disabled={!selectedFile}>
            Upload
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    z-index: 1000;
  }

  .modal-content {
    background: var(--surface-primary);
    padding: 2rem;
    border-radius: 8px;
    width: 100%;
    max-width: 500px;
    color: var(--text-primary);
  }

  h2 {
    font-size: 20px;
    margin: 0 0 1.5rem 0;
  }

  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    padding: 3rem;
    border: 3px dashed var(--border-primary);
    border-radius: 8px;
    background: var(--surface-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    color: var(--text-secondary);
    gap: 1.5rem;
  }

  .drop-zone:hover {
    border-color: var(--color-primary-600);
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .drop-zone.dragging {
    border-color: var(--color-primary-600);
    background: var(--color-primary-50);
    color: var(--color-primary-600);
  }

  .drop-text {
    font-size: 16px;
    font-weight: 500;
    text-align: center;
    margin: 0;
    max-width: 300px;
    line-height: 1.5;
  }

  .file-info {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 1rem 0 0 0;
    text-align: center;
    padding: 0.75rem;
    background: var(--surface-secondary);
    border-radius: 4px;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  button {
    flex: 1;
    padding: 0.75rem;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    border: none;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cancel-btn {
    background: var(--surface-secondary);
    color: var(--text-primary);
  }

  .cancel-btn:hover {
    background: var(--surface-hover);
  }

  .submit-btn {
    background: var(--color-primary-600);
    color: white;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--color-primary-700);
  }
</style>
