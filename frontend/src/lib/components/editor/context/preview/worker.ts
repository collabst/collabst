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
 * Everything here is worker-private: `worker` itself and the three latches that
 * track what it currently holds. Other modules reach them through the accessors
 * at the bottom rather than importing the bindings, so the invariants the
 * generation counter guards stay in one file.
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
// A sync walks the assets asynchronously, so a reset or a teardown can land
// while one is still in flight. Its remaining `addAsset` messages would reach a
// worker that no longer holds the sources they belong to, and the cache entries
// it writes afterwards would make the next sync skip re-adding them.
let syncGeneration = 0;

// A preview socket that has just opened called `svgDoc.reset()` and holds no
// document, so it needs a full artifact. Only the worker can produce one, and
// only after a reset — which also drops the sources it was given, so the caches
// mirroring them have to be dropped too or `_syncFilesAndAssets` would skip
// re-adding files the worker no longer has.

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
  // The compiler emits one full artifact and diffs from then on, and the
  // preview iframe can only merge a diff into the document it already holds.
  // An artifact produced before the iframe is listening is therefore not just
  // lost: every later diff rebases onto a document it never received, its
  // renderer faults and drops the socket, and it reconnects into the same
  // fault forever. So hold compilation until the iframe has asked for the
  // document; `handleIframeSend` compiles as soon as it does.
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
  // The worker registers its message handler immediately but only creates
  // `compiler` once the WASM bundle finishes loading; an `addFile`/`addAsset`
  // sent before that is silently dropped on the worker side (`if (!compiler)
  // return;`) with no signal back here. Without this guard this function still
  // records the file as loaded in `loadedFiles`/`loadedAssets`, so the real
  // sync that runs once the worker actually reports ready (see the
  // `'initialized'` handler) sees no diff and never re-sends it — the worker
  // ends up missing sources `compile()` then fails to find. Bailing out before
  // touching either cache keeps them honest until there is a worker to sync to.
  if (!worker || !workerReady) return;

  const generation = syncGeneration;

  // Handle files
  const currentFilesMap = new Map(get(files).map(f => [f.id, f]));

  // Remove deleted/moved files
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

  // Add new/updated files
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

  // Handle assets
  const currentAssetsMap = new Map(get(assets).map(a => [a.id, a]));

  // Remove deleted/moved assets
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

  // Add new/updated assets
  for (const asset of get(assets)) {
    const cached = loadedAssets.get(asset.id);
    const path = asset.path.startsWith('/') ? asset.path : `/${asset.path}`;

    if (!cached || cached.storage_path !== asset.storage_path || cached.path !== asset.path) {
      try {
        let arrayBuffer: ArrayBuffer;

        // Try IndexedDB cache first
        const cachedBlob = await getCachedAsset(String(asset.project_id), asset.id, asset.storage_path);

        if (cachedBlob) {
          // Use cached data
          arrayBuffer = cachedBlob.blob;
        } else {
          // Fetch from API and cache
          const { url } = await assetsApi.getUrl(String(asset.project_id), asset.id);
          const response = await fetch(url);
          arrayBuffer = await response.arrayBuffer();

          // Store in IndexedDB cache (fire and forget)
          cacheAsset(String(asset.project_id), asset.id, asset.storage_path, asset.mime_type, arrayBuffer)
            .catch(err => console.warn('Failed to cache asset:', err));
        }

        if (generation !== syncGeneration) return;

        const uint8Array = new Uint8Array(arrayBuffer);

        worker.postMessage({
          type: 'addAsset',
          payload: { path, data: uint8Array }
        }, [uint8Array.buffer]); // Transfer ownership of the buffer

        loadedAssets.set(asset.id, { path: asset.path, storage_path: asset.storage_path });
      } catch (error) {
        console.error('Failed to load asset:', asset.path, error);
      }
    }
  }

  if (generation !== syncGeneration) return;

  // Trigger compilation
  compile();
}

function syncFilesAndAssets() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    _syncFilesAndAssets();
  }, 30); // 30ms debounce
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
      // Only compile results carry diagnostics. `status`, `pdf` and `reset`
      // messages do not, and passing their `undefined` through defaulted to an
      // empty list — which wiped the issues panel right after a failed compile.
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

          // Force a sync only when file hydration is ready.
          if (compileEnabled) {
            syncFilesAndAssets();
          }
          reapplyCurrentZoomMode();
          break;

        case 'compiled':
          // Mirrors the worker, which only flips its own `hasCompiled` when it
          // actually emitted an artifact.
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

            // `sendVectorDataToIframe` aims at whichever surface is showing
            // the preview — the panel's frame or the separate window's.
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
          // if (typstDoc) typstDoc.reset();
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

// --- Exports -----------------------------------------------------------------

// --- Accessors ---------------------------------------------------------------
//
// `worker` and `workerReady` are read by `./exports`, which needs to know there
// is a compiler to post to. They stay private here so that nothing outside can
// post to a worker that is not ready, or hold a reference across a teardown.

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
