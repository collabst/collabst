<script lang="ts">
  export let show: boolean
  export let onClose: () => void
  export let onUpload: (file: File) => void

  let fileInput: HTMLInputElement
  let selectedFile: File | null = null

  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement
    selectedFile = target.files?.[0] || null
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
</script>

{#if show}
  <div class="modal" on:click={handleBackdropClick} role="dialog" aria-modal="true">
    <div class="modal-content" on:click|stopPropagation role="document">
      <h2>Upload Asset</h2>
      <form on:submit={handleSubmit}>
        <div class="field">
          <label for="assetFile">Select File</label>
          <input
            id="assetFile"
            bind:this={fileInput}
            type="file"
            on:change={handleFileSelect}
            required
          />
          {#if selectedFile}
            <p class="file-info">Selected: {selectedFile.name}</p>
          {/if}
        </div>
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
    max-width: 400px;
    color: var(--text-primary);
  }

  h2 {
    font-size: 20px;
    margin: 0 0 1.5rem 0;
  }

  .field {
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: 14px;
    font-weight: 600;
  }

  input[type="file"] {
    padding: 0.75rem;
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    font-size: 14px;
    background: var(--surface-secondary);
    color: var(--text-primary);
  }

  .file-info {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0;
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
