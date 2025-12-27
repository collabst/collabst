<script lang="ts">
  import Hand from "@lucide/svelte/icons/hand";

  interface UploadAssetModalProps {
    show: boolean;
    onClose: () => void;
    onUpload: (file: File) => void;
  }

  let { show, onClose, onUpload }: UploadAssetModalProps = $props();

  let fileInput: HTMLInputElement;
  let selectedFile: File | null = $state(null);
  let isDragging = $state(false);

  // Handle Escape key when modal is open
  $effect(() => {
    if (!show) return;

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    selectedFile = target.files?.[0] || null;
    console.log("Selected file:", selectedFile);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      selectedFile = files[0];
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (selectedFile) {
      onUpload(selectedFile);
      selectedFile = null;
      if (fileInput) fileInput.value = "";
    }
  }

  function handleBackdropClick() {
    onClose();
  }

  function openFilePicker() {
    fileInput?.click();
  }
</script>

{#if show}
  <div
    class="modal"
    on:click={handleBackdropClick}
    role="dialog"
    aria-modal="true"
  >
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
          <p class="drop-text">
            Click or drag and drop files here to upload them
          </p>
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
    background: var(--dialog-backdrop);
    backdrop-filter: blur(var(--dialog-backdrop-blur));
    -webkit-backdrop-filter: blur(var(--dialog-backdrop-blur));
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    z-index: var(--z-modal-backdrop);
  }

  .modal-content {
    background: var(--dialog-bg);
    border: 2px solid var(--dialog-border);
    padding: 2rem;
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 500px;
    color: var(--dialog-text);
    box-shadow: var(--shadow-2xl);
    animation: slideUp var(--transition-base);
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  h2 {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    margin: 0 0 1.5rem 0;
    color: var(--dialog-text);
  }

  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    padding: 3rem;
    border: 3px dashed var(--border-primary);
    border-radius: var(--radius-lg);
    background: var(--surface-secondary);
    cursor: pointer;
    color: var(--text-secondary);
    gap: 1.5rem;
  }

  :global([data-theme="light"]) .drop-zone {
    border-color: var(--border-tertiary);
    background: rgba(200, 200, 200, 0.5);
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
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    text-align: center;
    margin: 0;
    max-width: 300px;
    line-height: 1.5;
  }

  .file-info {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 1rem 0 0 0;
    text-align: center;
    padding: 0.75rem;
    background: var(--surface-secondary);
    border-radius: var(--radius-md);
  }

  .modal-actions {
    display: flex;
    gap: var(--space-3);
    margin-top: 1.5rem;
  }

  button {
    flex: 1;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-weight: var(--font-semibold);
    cursor: pointer;
    border: none;
    transition: all var(--transition-fast);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cancel-btn {
    background: var(--dialog-cancel-btn-bg);
    color: var(--dialog-text);
  }

  .cancel-btn:hover {
    background: var(--dialog-cancel-btn-hover);
  }

  .submit-btn {
    background: var(--color-primary-600);
    color: white;
  }

  .submit-btn:hover {
    background: var(--color-primary-500-saturated);
    transform: translateY(-1px);
    box-shadow: 0 1px 8px var(--color-primary-glow);
  }
</style>
