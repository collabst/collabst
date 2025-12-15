import type { File, Asset } from "../types";
import { assetsApi } from "../services/api";

// Cache to track loaded assets: Map<assetId, {storage_path, filename}>
// This helps detect when an asset has changed (different storage_path)
const loadedAssets = new Map<number, { storage_path: string; filename: string }>();

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
  if ('storage_path' in file) {
    // It's an Asset
    const path = "/" + file.filename;
    const cached = loadedAssets.get(file.id);

    // Check if this asset is already loaded and hasn't changed
    if (cached && cached.storage_path === file.storage_path) {
      console.log("Asset already loaded and unchanged:", file.filename);
      return;
    }

    // If the asset exists but storage_path changed, remove the old version
    if (cached) {
      console.log("Asset changed, removing old version:", file.filename);
      compiler.unmapShadow(path);
    }

    console.log("Adding asset to compiler:", file.filename);

    try {
      // Fetch the asset URL from the backend
      const { url } = await assetsApi.getUrl(projectId, file.id);

      // Fetch the actual binary content
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      console.log("Asset path in compiler:", path, "size:", uint8Array.length, "bytes");
      compiler.mapShadow(path, uint8Array);

      // Cache this asset's info
      loadedAssets.set(file.id, { storage_path: file.storage_path, filename: file.filename });
    } catch (error) {
      console.error("Failed to load asset:", file.filename, error);
    }
  } else {
    // It's a File
    console.log("Adding file to compiler:", file.name);
    const path = "/" + file.name;
    compiler.addSource(path, file.content);
  }
}

// Remove assets that are no longer in the project or have been renamed
export function cleanupDeletedAssets(compiler: any, currentAssets: Asset[]) {
  const currentAssetsMap = new Map(currentAssets.map(a => [a.id, a]));

  for (const [assetId, assetInfo] of loadedAssets) {
    const currentAsset = currentAssetsMap.get(assetId);
    
    if (!currentAsset) {
      // Asset was deleted
      console.log("Removing deleted asset:", assetInfo.filename);
      const path = "/" + assetInfo.filename;
      compiler.unmapShadow(path);
      loadedAssets.delete(assetId);
    } else if (currentAsset.filename !== assetInfo.filename) {
      // Asset was renamed - remove old path, it will be re-added with new name
      console.log("Removing renamed asset old path:", assetInfo.filename, "->", currentAsset.filename);
      const oldPath = "/" + assetInfo.filename;
      compiler.unmapShadow(oldPath);
      loadedAssets.delete(assetId);
    }
  }
}

// Clear the asset cache when needed (e.g., when switching projects)
export function resetAssetCache() {
  loadedAssets.clear();
}

export async function compileTypst(
  compiler: any,
  mainFilePath: string
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

export async function renderPDF(
  compiler: any,
  mainFilePath: string
): Promise<Uint8Array> {
  const result = await compiler.compile({
    mainFilePath,
    format: "pdf",
  });
  return result;
}
