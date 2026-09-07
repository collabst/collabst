import { assetsApi } from "$lib/services/api";
import { notifications } from "$lib/stores/notifications";
import { getCachedAsset } from "$lib/utils/assetCache";
import { getFileText } from "$lib/yjs";
import { assets, files, mainFile, project, projectYjs, ydoc } from "../state";
import { getWorker, isWorkerReady } from "./worker";
import { get } from "svelte/store";

/** Saving the document out: the compiler's PDF, or the sources as a ZIP. */

export function exportPdf() {
  const worker = getWorker();
  if (!worker || !isWorkerReady()) {
    notifications.show("The compiler is not ready yet", "warning", 3000);
    return;
  }
  const mainFilePath = get(mainFile)?.path || '/main.typ';
  const path = mainFilePath.startsWith('/') ? mainFilePath : `/${mainFilePath}`;
  worker.postMessage({ type: 'exportPDF', payload: { mainFilePath: path } });
}

// File contents come from the Yjs document, never from `file.content`: the REST
// row carries whatever was last persisted, which lags behind what the user (and
// everyone else) has typed.
export async function exportSourcesAsZip() {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  const ydocValue = get(projectYjs)?.ydoc ?? null;

  for (const file of get(files)) {
    if (file.is_folder) continue;
    const path = file.path.startsWith('/') ? file.path.slice(1) : file.path;
    zip.file(path, getFileText(ydocValue, file.id)?.toString() ?? "");
  }

  for (const asset of get(assets)) {
    try {
      let arrayBuffer: ArrayBuffer;
      const cached = await getCachedAsset(String(asset.project_id), asset.id, asset.storage_path);
      if (cached) {
        arrayBuffer = cached.blob;
      } else {
        const { url } = await assetsApi.getUrl(String(asset.project_id), asset.id);
        const response = await fetch(url);
        arrayBuffer = await response.arrayBuffer();
      }
      const path = asset.path.startsWith('/') ? asset.path.slice(1) : asset.path;
      zip.file(path, arrayBuffer);
    } catch (error) {
      console.error('Failed to add asset to ZIP:', asset.path, error);
      notifications.show(`Could not add ${asset.filename} to the archive`, "warning", 4000);
    }
  }

  try {
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `${get(project)?.name || 'project'}-sources.zip`);
  } catch (error) {
    console.error('Failed to export sources as ZIP:', error);
    notifications.show("Failed to export sources as ZIP", "error", 5000);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { downloadBlob };
