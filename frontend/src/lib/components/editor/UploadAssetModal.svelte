<script lang="ts">
  import Hand from "@lucide/svelte/icons/hand";
    import { X, ListX } from "@lucide/svelte";

  interface UploadAssetModalProps {
    show: boolean;
    onClose: () => void;
    onUpload: (files: File[]) => Promise<void> | void;
  }

  let { show, onClose, onUpload }: UploadAssetModalProps = $props();

  let fileInput: HTMLInputElement | undefined = $state();
  let stagedFiles: File[] = $state([]);
  let isDragging = $state(false);
  let isUploading = $state(false);

  function handleClose() {
    if (isUploading) return;
    onClose();
  }

  // Handle Escape key when modal is open
  $effect(() => {
    if (!show) return;

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  function fileSignature(file: File): string {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    const existing = new Set(stagedFiles.map(fileSignature));
    const uniqueIncoming = incoming.filter((file) => {
      const signature = fileSignature(file);
      if (existing.has(signature)) {
        return false;
      }
      existing.add(signature);
      return true;
    });

    if (uniqueIncoming.length > 0) {
      stagedFiles = [...stagedFiles, ...uniqueIncoming];
    }
  }

  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      addFiles(target.files);
    }
    target.value = "";
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const files = e.dataTransfer?.files;
    if (files) {
      addFiles(files);
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

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (stagedFiles.length === 0 || isUploading) return;

    isUploading = true;
    try {
      await onUpload(stagedFiles);
      stagedFiles = [];
      if (fileInput) fileInput.value = "";
    } finally {
      isUploading = false;
    }
  }

  function removeStagedFile(index: number) {
    stagedFiles = stagedFiles.filter((_, i) => i !== index);
  }

  function clearStagedFiles() {
    stagedFiles = [];
    if (fileInput) fileInput.value = "";
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleDropZoneKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    }
  }

  function openFilePicker() {
    fileInput?.click();
  }
</script>

{#if show}
  <div
    class="modal"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div class="modal-content" role="dialog" aria-modal="true" tabindex="-1">
      <h2>Upload Files</h2>
      <form onsubmit={handleSubmit}>
        <input
          bind:this={fileInput}
          type="file"
          multiple
          onchange={handleFileSelect}
          style="display: none;"
        />

        <div
          class="drop-zone"
          class:dragging={isDragging}
          onclick={openFilePicker}
          ondrop={handleDrop}
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          onkeydown={handleDropZoneKeydown}
          role="button"
          tabindex="0"
        >
          <Hand size={64} strokeWidth={1.5} />
          <p class="drop-text">
            Click or drag and drop files here to stage them
          </p>
        </div>

        {#if stagedFiles.length > 0}
          <div class="file-list-header">
            <p class="file-info">{stagedFiles.length} file(s) ready to upload</p>
            <button
              type="button"
              class="clear-btn"
              onclick={clearStagedFiles}
              disabled={isUploading}
            >
              <ListX size={16} />
              Clear List
            </button>
          </div>

          <ul class="file-list" aria-label="Staged upload files">
            {#each stagedFiles as stagedFile, index}
              <li class="file-row">
                <div class="file-meta">
                  <span class="file-name" title={stagedFile.name}>{stagedFile.name}</span>
                  <span class="file-size">{formatFileSize(stagedFile.size)}</span>
                </div>
                <button
                  type="button"
                  class="remove-btn"
                  aria-label={`Remove ${stagedFile.name}`}
                  title="Remove from upload batch"
                  onclick={() => removeStagedFile(index)}
                  disabled={isUploading}
                >
                  <X size={16} />
                </button>
              </li>
            {/each}
          </ul>
        {/if}

        <div class="modal-actions">
          <button type="button" onclick={handleClose} class="cancel-btn" disabled={isUploading}>
            Cancel
          </button>
          <button
            type="submit"
            class="submit-btn"
            disabled={stagedFiles.length === 0 || isUploading}
          >
            {isUploading ? "Uploading..." : "Upload"}
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
    font-size: 2.3rem;
    font-weight: 900;
    margin: 0rem 0 1.5rem 0.1rem;
    color: var(--dialog-text);
    letter-spacing: -0.02em;
    font-family: "DM Serif Display", Georgia, serif;
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
    background: rgba(176, 199, 199, 0.5);
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
    text-align: center;
    padding: 0.75rem;
  }

  .file-list-header {
    margin-top: 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .clear-btn {
    flex: 0 0 auto;
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--text-xs);
    padding: 0.4rem 0.7rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .clear-btn:hover {
    color: var(--text-primary);
  }

  .file-list {
    margin: 0.75rem 0 0;
    padding: 1rem;
    list-style: none;
    border-top: 1px solid var(--border-primary);
    max-height: 220px;
    overflow: auto;
  }

  .file-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--border-secondary);
  }

  .file-row:last-child {
    border-bottom: none;
  }

  .file-meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .file-name {
    font-size: var(--text-sm);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
  }

  .file-size {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .remove-btn {
    flex: 0 0 auto;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    background: transparent;
    color: var(--text-secondary);
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-btn:hover {
    color: var(--text-primary);
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

  .cancel-btn:active {
    background: var(--dialog-cancel-btn-active);
  }

  .submit-btn {
    background: var(--color-primary-600);
    color: white;
  }

  .submit-btn:hover {
    background: var(--color-primary-500-saturated);
    box-shadow: 0 1px 8px var(--color-primary-glow);
  }

  .submit-btn:active {
    box-shadow: 0 1px 16px var(--color-primary-glow);
  }
</style>
