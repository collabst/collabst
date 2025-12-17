import type { File, Asset } from "../types";
import { assetsApi } from "../services/api";

// Cache to track loaded assets: Map<assetId, {storage_path, path}>
// This helps detect when an asset has changed (different storage_path) or moved
const loadedAssets = new Map<number, { storage_path: string; path: string }>();

// Cache to track loaded files: Map<fileId, filename>
// This helps detect when a file has been renamed
const loadedFiles = new Map<number, string>();

export async function addFileToCompiler(
  compiler: any,
  file: (File | Asset)[] | File | Asset,
  projectId: number,
) {
  if (Array.isArray(file)) {
    for (const f of file) {
      await addFileToCompiler(compiler, f, projectId);
    }
    return;
  }
  if ("storage_path" in file) {
    // It's an Asset
    // Use the full path from backend (supports nested folders)
    const path = file.path.startsWith('/') ? file.path : `/${file.path}`;
    const cached = loadedAssets.get(file.id);

    // Check if this asset is already loaded and hasn't changed or moved
    if (cached && cached.storage_path === file.storage_path && cached.path === file.path) {
      console.log("Asset already loaded and unchanged:", file.path);
      return;
    }

    // If the asset exists but was moved or changed, remove the old version
    if (cached) {
      if (cached.path !== file.path) {
        console.log("Asset moved, removing old path:", cached.path, "->", file.path);
      } else {
        console.log("Asset changed, removing old version:", file.path);
      }
      const oldPath = cached.path.startsWith('/') ? cached.path : `/${cached.path}`;
      compiler.unmapShadow(oldPath);
    }

    console.log("Adding asset to compiler:", file.path);

    try {
      // Fetch the asset URL from the backend
      const { url } = await assetsApi.getUrl(projectId, file.id);

      // Fetch the actual binary content
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      console.log(
        "Asset path in compiler:",
        path,
        "size:",
        uint8Array.length,
        "bytes",
      );
      compiler.mapShadow(path, uint8Array);

      // Cache this asset's info (including path for move detection)
      loadedAssets.set(file.id, { storage_path: file.storage_path, path: file.path });
    } catch (error) {
      console.error("Failed to load asset:", file.path, error);
    }
  } else {
    // It's a File

    // Skip folders - they don't get added to compiler
    if (file.is_folder) {
      console.log("Skipping folder:", file.name);
      return;
    }

    // Use the full path from backend (supports nested folders)
    const path = file.path.startsWith('/') ? file.path : `/${file.path}`;
    const cached = loadedFiles.get(file.id);

    // If the file exists but was renamed/moved, remove the old version
    if (cached && cached !== file.path) {
      console.log("File moved/renamed, removing old path:", cached, "->", file.path);
      const oldPath = cached.startsWith('/') ? cached : `/${cached}`;
      compiler.unmapShadow(oldPath);
    }

    console.log("Adding file to compiler:", file.path);
    compiler.addSource(path, file.content);

    // Cache this file's path (not just name, for folder support)
    loadedFiles.set(file.id, file.path);
  }
}

// Remove assets and files that are no longer in the project or have been renamed
export function cleanupDeletedAssets(
  compiler: any,
  currentAssets: Asset[],
  currentFiles: File[],
) {
  const currentAssetsMap = new Map(currentAssets.map((a) => [a.id, a]));
  const currentFilesMap = new Map(currentFiles.map((f) => [f.id, f]));

  // Cleanup assets
  for (const [assetId, assetInfo] of loadedAssets) {
    const currentAsset = currentAssetsMap.get(assetId);

    if (!currentAsset) {
      // Asset was deleted
      console.log("Removing deleted asset:", assetInfo.path);
      const path = assetInfo.path.startsWith('/') ? assetInfo.path : `/${assetInfo.path}`;
      compiler.unmapShadow(path);
      loadedAssets.delete(assetId);
    } else if (currentAsset.path !== assetInfo.path) {
      // Asset was renamed/moved - remove old path, it will be re-added with new path
      console.log("Removing asset old path:", assetInfo.path, "->", currentAsset.path);
      const oldPath = assetInfo.path.startsWith('/') ? assetInfo.path : `/${assetInfo.path}`;
      compiler.unmapShadow(oldPath);
      loadedAssets.delete(assetId);
    }
  }

  // Cleanup files
  for (const [fileId, cachedPath] of loadedFiles) {
    const currentFile = currentFilesMap.get(fileId);

    if (!currentFile) {
      // File was deleted
      console.log("Removing deleted file:", cachedPath);
      const path = cachedPath.startsWith('/') ? cachedPath : `/${cachedPath}`;
      compiler.unmapShadow(path);
      loadedFiles.delete(fileId);
    } else if (currentFile.path !== cachedPath) {
      // File was renamed/moved - remove old path, it will be re-added with new path
      console.log("Removing file old path:", cachedPath, "->", currentFile.path);
      const oldPath = cachedPath.startsWith('/') ? cachedPath : `/${cachedPath}`;
      compiler.unmapShadow(oldPath);
      loadedFiles.delete(fileId);
    }
  }
}

// Clear the asset and file caches when needed (e.g., when switching projects)
export function resetAssetCache() {
  loadedAssets.clear();
  loadedFiles.clear();
}

export async function compileTypst(
  compiler: any,
  mainFilePath: string,
): Promise<any> {
  return await compiler.compile({
    mainFilePath,
    diagnostics: "full",
  });
}

export async function renderTypst(
  renderer: any,
  compiledResult: any,
): Promise<string> {
  return await renderer.runWithSession(async (session: any) => {
    renderer.manipulateData({
      renderSession: session,
      action: "reset",
      data: compiledResult,
    });
    return renderer.renderSvg({ renderSession: session });
  });
}
