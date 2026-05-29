<script lang="ts">
    import type { Asset } from "$lib/types";

    interface AssetMetadataProps {
        asset: Asset;
        imageDimensions?: { width: number; height: number } | null;
    }

    let { asset, imageDimensions = null }: AssetMetadataProps = $props();

    function formatFileSize(bytes: number): string {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (
            Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
        );
    }

    function formatDate(
        primaryDateString: string,
        fallbackDateString?: string,
    ): string {
        const primaryDate = new Date(primaryDateString);
        const fallbackDate = fallbackDateString
            ? new Date(fallbackDateString)
            : null;
        const date = Number.isNaN(primaryDate.getTime())
            ? fallbackDate
            : primaryDate;

        if (!date || Number.isNaN(date.getTime())) {
            // Keep a deterministic date output when timestamps are malformed.
            return new Date().toLocaleDateString();
        }

        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        const timeStr = date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });

        if (diffDays === 0) {
            return `Today at ${timeStr}`;
        } else if (diffDays === 1) {
            return `Yesterday at ${timeStr}`;
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    function getFileExtension(filename: string): string {
        const parts = filename.split(".");
        return parts.length > 1
            ? parts[parts.length - 1].toUpperCase()
            : "FILE";
    }

    function isImage(mimeType: string): boolean {
        return mimeType.startsWith("image/");
    }
</script>

<div class="asset-metadata">
    <h3 class="filename">{asset.filename}</h3>

    <div class="metadata-grid">
        <div class="metadata-row">
            <span class="metadata-label">Format</span>
            <span class="metadata-value"
                >{getFileExtension(asset.filename)}</span
            >
        </div>

        {#if imageDimensions && isImage(asset.mime_type) && !asset.mime_type.includes("svg")}
            <div class="metadata-row">
                <span class="metadata-label">Resolution</span>
                <span class="metadata-value"
                    >{imageDimensions.width} × {imageDimensions.height}</span
                >
            </div>
        {/if}

        <div class="metadata-row">
            <span class="metadata-label">Size</span>
            <span class="metadata-value">{formatFileSize(asset.size)}</span>
        </div>

        <div class="metadata-row">
            <span class="metadata-label">Last changed</span>
            <span class="metadata-value"
                >{formatDate(asset.updated_at, asset.created_at)}</span
            >
        </div>
    </div>
</div>

<style>
    .asset-metadata {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-4);
        width: 100%;
        max-width: 500px;
    }

    .filename {
        color: var(--text-primary);
        font-size: var(--text-lg);
        font-weight: 600;
        margin: 0;
        text-align: center;
    }

    .metadata-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        width: 100%;
        gap: var(--space-2) 0;
    }

    .metadata-row {
        display: contents;
    }

    .metadata-label {
        color: var(--text-secondary);
        font-size: var(--text-sm);
        font-weight: 500;
        text-align: right;
        padding-right: var(--space-2);
    }

    .metadata-value {
        color: var(--text-primary);
        font-size: var(--text-sm);
        text-align: left;
        padding-left: var(--space-2);
    }
</style>
