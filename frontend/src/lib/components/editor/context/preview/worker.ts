import { assetsApi } from "$lib/services/api";
import { cacheAsset, getCachedAsset } from "$lib/utils/assetCache";
import { onDiagnostics } from "../editor/diagnostics";
import {
  assets,
  compileStatus,
  diagnostics,
  files,
  mainFile,
  previewStatus,
  project,
  projectYjs,
  ydoc,
} from "../state";
import { downloadBlob } from "./exports";
import {
  isIframeInitialized,
  reapplyCurrentZoomMode,
  sendVectorDataToIframe,
} from "./iframe";
import { get } from "svelte/store";

/**
 * The Typst compile worker and the file/asset mirror it compiles against.
 *
 * The worker and the latches tracking what it holds stay private; other modules
 * go through the accessors at the bottom.
 */

let compileEnabled = true;

let worker: Worker | undefined;
let workerInitialized = false;

let syncTimeout: ReturnType<typeof setTimeout>;
const loadedFiles = new Map<string, { path: string; content: string }>();
const loadedAssets = new Map<string, { path: string; storage_path: string }>();
let workerReady = false;
// Mirrors the worker's own `hasCompiled`: once it is set, the worker only
// produces diffs, and only a `reset` makes it emit a full artifact again.
let workerHasCompiled = false;
// Bumped on reset and teardown so an in-flight sync drops its remaining
// `addAsset` messages instead of feeding a worker that no longer holds them.
let syncGeneration = 0;

// A freshly opened preview socket holds no document and needs a full artifact,
// which the worker only emits after a reset. The reset also drops its sources,
// so the caches mirroring them must be cleared or the next sync skips them.
function resetWorkerDocument() {
  if (!worker || !workerReady || !workerHasCompiled) return;
  syncGeneration++;
  worker.postMessage({ type: 'reset' });
  workerHasCompiled = false;
  loadedFiles.clear();
  loadedAssets.clear();
}

function compile() {
  if (!worker || !workerReady) return;
  // The compiler emits one full artifact then diffs, and the iframe can only
  // merge a diff into a document it already holds. Hold compilation until the
  // iframe has asked for the document; `handleIframeSend` then compiles.
  if (!isIframeInitialized()) {
    compileStatus.set('Preparing files...');
    return;
  }
  previewStatus.set('compiling');
  const mainFilePath = get(mainFile)?.path || '/main.typ';
  const path = mainFilePath.startsWith('/') ? mainFilePath : `/${mainFilePath}`;
  worker.postMessage({
    type: 'compile',
    payload: { mainFilePath: path },
  });
}

async function _syncFilesAndAssets() {
  // The worker silently drops `addFile`/`addAsset` sent before its WASM bundle
  // loads. Bail out before touching the caches, otherwise they record files the
  // worker never got and the sync after `'initialized'` sees no diff to re-send.
  if (!worker || !workerReady) return;

  const generation = syncGeneration;

  const currentFilesMap = new Map(get(files).map(f => [f.id, f]));

  for (const [fileId, cached] of loadedFiles) {
    const current = currentFilesMap.get(fileId);
    if (!current || current.path !== cached.path) {
      const pathToRemove = cached.path.startsWith('/') ? cached.path : `/${cached.path}`;
      worker.postMessage({
        type: 'removeFile',
        payload: { path: pathToRemove }
      });
      loadedFiles.delete(fileId);
    }
  }

  for (const file of get(files)) {
    if (file.is_folder) continue;

    const cached = loadedFiles.get(file.id);
    const path = file.path.startsWith('/') ? file.path : `/${file.path}`;

    const content = get(projectYjs)?.ydoc.getText(`file-${file.id}`).toString() || '';
    if (!cached || cached.content !== content || cached.path !== file.path) {
      worker.postMessage({
        type: 'addFile',
        payload: { path, content }
      });
      loadedFiles.set(file.id, { path: file.path, content });
    }
  }

  const currentAssetsMap = new Map(get(assets).map(a => [a.id, a]));

  for (const [assetId, cached] of loadedAssets) {
    const current = currentAssetsMap.get(assetId);
    if (!current || current.path !== cached.path) {
      const pathToRemove = cached.path.startsWith('/') ? cached.path : `/${cached.path}`;
      worker.postMessage({
        type: 'removeFile',
        payload: { path: pathToRemove }
      });
      loadedAssets.delete(assetId);
    }
  }

  for (const asset of get(assets)) {
    const cached = loadedAssets.get(asset.id);
    const path = asset.path.startsWith('/') ? asset.path : `/${asset.path}`;

    if (!cached || cached.storage_path !== asset.storage_path || cached.path !== asset.path) {
      try {
        let arrayBuffer: ArrayBuffer;

        const cachedBlob = await getCachedAsset(String(asset.project_id), asset.id, asset.storage_path);

        if (cachedBlob) {
          arrayBuffer = cachedBlob.blob;
        } else {
          const { url } = await assetsApi.getUrl(String(asset.project_id), asset.id);
          const response = await fetch(url);
          arrayBuffer = await response.arrayBuffer();

          cacheAsset(String(asset.project_id), asset.id, asset.storage_path, asset.mime_type, arrayBuffer)
            .catch(err => console.warn('Failed to cache asset:', err));
        }

        if (generation !== syncGeneration) return;

        const uint8Array = new Uint8Array(arrayBuffer);

        worker.postMessage({
          type: 'addAsset',
          payload: { path, data: uint8Array }
        }, [uint8Array.buffer]);

        loadedAssets.set(asset.id, { path: asset.path, storage_path: asset.storage_path });
      } catch (error) {
        console.error('Failed to load asset:', asset.path, error);
      }
    }
  }

  if (generation !== syncGeneration) return;

  compile();
}

function syncFilesAndAssets() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    _syncFilesAndAssets();
  }, 30);
}

export function initWorker() {
  if (!workerInitialized) {
    workerInitialized = true;
    worker = new Worker(
      new URL('/src/lib/preview/typst-worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = async (e) => {
      const { type, vectorData, compileTime, isFirstCompile, diagnostics } = e.data;
      // Only compile results carry diagnostics; other messages must not clear
      // the issues panel.
      if (Array.isArray(diagnostics)) onDiagnostics(diagnostics);

      switch (type) {
        case 'status':
          compileStatus.set(e.data.message);
          break;

        case 'initialized':
          workerReady = true;
          compileStatus.set(compileEnabled
            ? 'Compiler ready - waiting for iframe...'
            : 'Preparing files...');

          if (compileEnabled) {
            syncFilesAndAssets();
          }
          reapplyCurrentZoomMode();
          break;

        case 'compiled':
          // The worker flips its own `hasCompiled` only when it emitted one.
          if (vectorData) workerHasCompiled = true;
          if (!isIframeInitialized()) {
            compileStatus.set('Waiting for iframe...');
            return;
          }

          if (!vectorData) {
            compileStatus.set(`Ready (${compileTime}ms) - no output`);
            previewStatus.set('ready');
            return;
          }

          try {
            compileStatus.set('Rendering...');

            sendVectorDataToIframe(vectorData, isFirstCompile);

            compileStatus.set(`Ready (${compileTime}ms)`);
            previewStatus.set('ready');
          } catch (error: any) {
            compileStatus.set(`Render error: ${error.message}`);
            previewStatus.set('error');
            console.error('Render error:', error);
          }
          break;

        case 'error':
          compileStatus.set(`Compile error: ${e.data.error}`);
          previewStatus.set('error');
          console.error('Compilation error:', e.data);
          break;

        case 'pdf':
          downloadBlob(
            new Blob([e.data.pdfData], { type: 'application/pdf' }),
            `${get(project)?.name || 'document'}.pdf`,
          );
          break;

        case 'reset':
          console.log('Worker: Resetting document as requested');
          compileStatus.set('Reset complete');
          break;
      }
    };

    worker.onerror = (e) => {
      const errorMsg = e.message || (e.error as any)?.message || 'Unknown error';
      compileStatus.set(`Worker error: ${errorMsg}`);
      previewStatus.set('error');
      console.error('Worker error:', e);
    };
  }
}

// `./exports` needs to know there is a compiler to post to, without being able
// to hold the reference across a teardown.
export function getWorker(): Worker | undefined {
  return worker;
}

export function isWorkerReady(): boolean {
  return workerReady;
}

export { resetWorkerDocument, syncFilesAndAssets };

/** Terminate the worker and forget everything it was holding. */
export function disposeWorker() {
  worker?.terminate();
  worker = undefined;
  workerInitialized = false;
  workerReady = false;
  workerHasCompiled = false;
  // Any sync still walking the assets belongs to the project being torn down.
  syncGeneration++;
  if (syncTimeout) clearTimeout(syncTimeout);
  loadedFiles.clear();
  loadedAssets.clear();
}
