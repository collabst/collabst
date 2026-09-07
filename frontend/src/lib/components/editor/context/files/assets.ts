import { assetsApi } from "$lib/services/api";
import { notifications } from "$lib/stores/notifications";
import { type Asset } from "$lib/types";
import { cacheAsset, createBlobUrl, getCachedAsset, revokeBlobUrl } from "$lib/utils/assetCache";
import { errorDetail } from "../lifecycle";
import { onAssetCreated, onFileCreated } from "../project/realtime";
import { syncFilesAndAssets } from "../preview/worker";
import {
  assets,
  canWrite,
  files,
  projectId,
  selectedAsset,
  selectedAssetUrl,
  type Disposer,
} from "../state";
import type { File } from "../types";
import { anchorFolder, expandFolders } from "./tree";
import { get } from "svelte/store";

/**
 * Assets: uploading them, showing one in place of the editor, and the object
 * URLs that back that view.
 */

export async function uploadAssets(
  filesToUpload: globalThis.File[],
  parentId: string | null = null,
) {
  if (!get(canWrite)) return;
  if (filesToUpload.length === 0) return;

  const $projectId = get(projectId);
  let uploaded = 0;
  let failed = 0;
  const renamed: string[] = [];

  for (const file of filesToUpload) {
    try {
      const created = await assetsApi.upload($projectId, file, parentId);

      if ("mime_type" in created) {
        cacheAsset(
          $projectId,
          created.id,
          created.storage_path,
          created.mime_type,
          await file.arrayBuffer(),
        ).catch((err) => console.warn("Failed to cache uploaded asset:", err));
        onAssetCreated(created);
        if (created.filename !== file.name) {
          renamed.push(`${file.name} → ${created.filename}`);
        }
      } else {
        onFileCreated(created);
        if (created.name !== file.name) {
          renamed.push(`${file.name} → ${created.name}`);
        }
      }

      uploaded += 1;
    } catch (error) {
      failed += 1;
      console.error("Failed to upload file:", file.name, error);
      notifications.show(
        errorDetail(error, `Failed to upload ${file.name}`),
        "error",
        5000,
      );
    }
  }

  if (uploaded > 0 && failed === 0) {
    notifications.show(`Uploaded ${uploaded} file(s)`, "info");
  } else if (uploaded > 0) {
    notifications.show(
      `Uploaded ${uploaded} file(s), ${failed} failed`,
      "warning",
      5000,
    );
  } else {
    notifications.show("No files uploaded", "error", 5000);
  }

  if (renamed.length > 0) {
    const preview = renamed.slice(0, 3).join("; ");
    const suffix = renamed.length > 3 ? ` (+${renamed.length - 3} more)` : "";
    notifications.show(`Auto-renamed: ${preview}${suffix}`, "info", 5000);
  }

  // The realtime handlers keep `assets` in sync for everyone else, but the
  // compiler only learns about the new bytes when something asks it to.
  if (uploaded > 0) syncFilesAndAssets();
}

// Same anchor rule as `newFileNextTo`: a folder takes the upload, a file hands it
// to the folder it sits in, nothing means the project root.
export function uploadAssetsNextTo(
  filesToUpload: globalThis.File[],
  nodeId: string | null,
) {
  const folder = anchorFolder(nodeId);
  if (folder) expandFolders([folder.id]);
  return uploadAssets(filesToUpload, folder?.id ?? null);
}

// --- Asset viewing -----------------------------------------------------------

// Blob URLs, keyed by asset *and* storage path: replacing an asset keeps its id
// but changes where the bytes live, and handing back the previous URL would show
// the previous picture. The old URL is revoked when its key is superseded, and
// the whole map when the context is torn down — an un-revoked blob URL pins its
// data in memory for the lifetime of the document.

const assetBlobUrls = new Map<string, string>();

function assetBlobKey(asset: Asset) {
  return `${asset.id}:${asset.storage_path}`;
}

export function releaseAssetBlobUrls(keep?: string) {
  for (const [key, url] of assetBlobUrls) {
    if (key === keep) continue;
    revokeBlobUrl(url);
    assetBlobUrls.delete(key);
  }
}

// The URL the asset view renders, or `null` while it is being fetched.

export function selectAsset(assetId: string) {
  const asset = get(assets).find((a) => a.id === assetId);
  if (!asset) return;
  selectedAsset.set(asset);
}

export function deselectAsset() {
  selectedAsset.set(null);
}

async function loadAssetBlobUrl(asset: Asset): Promise<string> {
  const key = assetBlobKey(asset);
  const known = assetBlobUrls.get(key);
  if (known) return known;

  let arrayBuffer: ArrayBuffer;
  const cached = await getCachedAsset(
    String(asset.project_id),
    asset.id,
    asset.storage_path,
  );
  if (cached) {
    arrayBuffer = cached.blob;
  } else {
    const { url } = await assetsApi.getUrl(String(asset.project_id), asset.id);
    const response = await fetch(url);
    arrayBuffer = await response.arrayBuffer();
    cacheAsset(
      String(asset.project_id),
      asset.id,
      asset.storage_path,
      asset.mime_type,
      arrayBuffer,
    ).catch((err) => console.warn("Failed to cache asset:", err));
  }

  const blobUrl = createBlobUrl(arrayBuffer, asset.mime_type);
  assetBlobUrls.set(key, blobUrl);
  return blobUrl;
}

let assetUrlGeneration = 0;

// These observers are what turns an edit — anyone's, local or remote — into a
// recompile and a refreshed search index.

/**
 * Show the selected asset, fetching and caching its bytes if this is the first
 * time. Used to be a module-scope subscription that outlived every project.
 */
export function wireAssetViewer(): Disposer {
  return selectedAsset.subscribe(async (asset) => {
    const generation = ++assetUrlGeneration;

    if (!asset) {
      selectedAssetUrl.set(null);
      return;
    }

    const key = assetBlobKey(asset);
    const known = assetBlobUrls.get(key);
    if (known) {
      selectedAssetUrl.set(known);
      return;
    }

    // Clear first: showing the previous asset's picture under the new asset's
    // name is worse than showing nothing for a moment.
    selectedAssetUrl.set(null);
    try {
      const url = await loadAssetBlobUrl(asset);
      // Two guards, not one: the selection can have moved on, and the whole
      // context can have been torn down while the bytes were in flight.
      if (generation !== assetUrlGeneration) return;
      selectedAssetUrl.set(url);
    } catch (error) {
      if (generation !== assetUrlGeneration) return;
      console.error("Failed to load asset:", asset.filename, error);
      notifications.show(`Could not open ${asset.filename}`, "error", 5000);
    }
  });
}
