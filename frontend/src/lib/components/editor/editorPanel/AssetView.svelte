<script lang="ts">
  import {
    deselectAsset,
    selectedAsset,
    selectedAssetUrl,
  } from "$lib/components/editor/context";
  import FileIcon from "@lucide/svelte/icons/file";
  import X from "@lucide/svelte/icons/x";

  let dimensions: { width: number; height: number } | null = $state(null);
  let isImage = $derived($selectedAsset?.mime_type.startsWith("image/") ?? false);

  // A new asset must not keep the previous one's resolution while it loads.
  $effect(() => {
    void $selectedAsset?.id;
    dimensions = null;
  });

  function handleImageLoad(event: Event) {
    const image = event.currentTarget as HTMLImageElement;
    dimensions = { width: image.naturalWidth, height: image.naturalHeight };
  }

  function formatSize(bytes: number) {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const unit = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / 1024 ** unit) * 100) / 100} ${units[unit]}`;
  }

  function formatDate(primary: string, fallback?: string) {
    const parsed = new Date(primary);
    const date = Number.isNaN(parsed.getTime())
      ? fallback
        ? new Date(fallback)
        : null
      : parsed;
    if (!date || Number.isNaN(date.getTime())) return "unknown";

    const days = Math.floor((Date.now() - date.getTime()) / 86400000);
    const time = date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    if (days === 0) return `Today at ${time}`;
    if (days === 1) return `Yesterday at ${time}`;
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  }

  function extensionOf(filename: string) {
    const parts = filename.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "FILE";
  }
</script>

{#if $selectedAsset}
  <div class="asset-view">
    <button class="close" onclick={deselectAsset} title="Close">
      <X size={18} />
    </button>

    <div class="preview">
      {#if !$selectedAssetUrl}
        <div class="placeholder">Loading…</div>
      {:else if isImage}
        <img
          src={$selectedAssetUrl}
          alt={$selectedAsset.filename}
          onload={handleImageLoad}
        />
      {:else}
        <div class="placeholder">
          <FileIcon size={48} />
          <a href={$selectedAssetUrl} download={$selectedAsset.filename}>
            Download {$selectedAsset.filename}
          </a>
        </div>
      {/if}
    </div>

    <div class="metadata">
      <div class="filename">{$selectedAsset.filename}</div>
      <div class="grid">
        <span class="label">Format</span>
        <span class="value">{extensionOf($selectedAsset.filename)}</span>
        {#if dimensions}
          <span class="label">Resolution</span>
          <span class="value">{dimensions.width} × {dimensions.height}</span>
        {/if}
        <span class="label">Size</span>
        <span class="value">{formatSize($selectedAsset.size)}</span>
        <span class="label">Last changed</span>
        <span class="value">
          {formatDate($selectedAsset.updated_at, $selectedAsset.created_at)}
        </span>
      </div>
    </div>
  </div>
{/if}

<style>
  .asset-view {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 3rem 1.5rem 1.5rem;
    background-color: var(--bg-editor);
    overflow: auto;
  }

  .close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.35rem;
    border: 1px solid transparent;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .close:hover {
    background-color: var(--surface-hover);
    color: var(--text-primary);
  }

  .preview {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    max-height: 60%;
  }

  .preview img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 0.5rem;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-tertiary);
    font-size: 0.9rem;
  }

  .placeholder a {
    color: var(--color-primary-500);
    font-weight: 600;
  }

  .metadata {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: 100%;
    max-width: 30rem;
  }

  .filename {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    text-align: center;
    word-break: break-all;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem 0;
    width: 100%;
  }

  .label {
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 500;
    text-align: right;
    padding-right: 0.5rem;
  }

  .value {
    color: var(--text-primary);
    font-size: 0.8rem;
    text-align: left;
    padding-left: 0.5rem;
  }
</style>
