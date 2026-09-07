import { getFileText } from "$lib/yjs";
import { updateOutline } from "../editor/diagnostics";
import { ytext } from "../editor/view";
import { syncFilesAndAssets } from "../preview/worker";
import { updateSearchMatches } from "../search";
import { files, projectYjs, selectedFile, type Disposer, ydoc } from "../state";
import { get } from "svelte/store";
import * as Y from "yjs";

/**
 * The Yjs text observers: what turns an edit — anyone's, local or remote — into
 * a recompile and a refreshed search index.
 */

let fileObservers = new Map<string, () => void>();
// The document the observers in `fileObservers` are attached to. Keying them by
// file id alone was not enough: `initContext` and
// `resetRealtimeConnectionsForWriteLoss` both swap the `Y.Doc` out from under
// them, and because the ids do not change, no observer was ever re-attached to
// the new document — edits went unnoticed and the preview stopped recompiling.
let observedYdoc: Y.Doc | null = null;

export function clearFileObservers() {
  for (const unobserve of fileObservers.values()) {
    unobserve();
  }
  fileObservers.clear();
  observedYdoc = null;
}

export function syncFileObservers() {
  const ydocValue = get(projectYjs)?.ydoc ?? null;

  if (ydocValue !== observedYdoc) {
    clearFileObservers();
    observedYdoc = ydocValue;
  }
  if (!ydocValue) return;

  const filesValue = get(files);

  // Clean up observers for deleted files
  for (const [fileId, unobserve] of fileObservers) {
    if (!filesValue.find((file) => file.id === fileId)) {
      unobserve();
      fileObservers.delete(fileId);
    }
  }

  // Set up observers for new files
  for (const file of filesValue) {
    if (!fileObservers.has(file.id)) {
      const ytext = getFileText(ydocValue, file.id);
      if (ytext) {
        // Yjs fires `observe` handlers synchronously, and for a local edit that
        // happens from inside yCollab's own CodeMirror `ViewPlugin.update()` —
        // i.e. while `view.dispatch()` for the keystroke is still on the call
        // stack. `updateSearchMatches()` can reach `updateMatchHighlights()`,
        // which calls `view.dispatch()` again; CodeMirror throws ("Calls to
        // EditorView.update are not allowed while an update is in progress"),
        // and its plugin error boundary disables yCollab for the view — after
        // that, local edits stop reaching Yjs entirely. Deferring past the
        // current call stack lets the in-flight dispatch finish first.
        const handler = () => {
          syncFilesAndAssets();
          setTimeout(updateSearchMatches, 0);
          if (get(selectedFile)?.id === file.id) setTimeout(updateOutline, 0);
        };
        ytext.observe(handler);
        fileObservers.set(file.id, () => ytext.unobserve(handler));
      }
    }
  }
}

/**
 * Wire the file tree to the document.
 *
 * Three subscriptions that used to sit at module scope and never come down
 * (`PHASE2.md` §2.2): the main-file tracker, the asset viewer, and the pair
 * that keeps the Yjs text observers in step with the file list. The last is
 * why teardown needed a generation counter — `files.set([])` re-entered
 * `syncFileObservers` against a document that was being destroyed.
 */

/**
 * Keep the observers in step with the file list and the document they belong
 * to. Both used to be module-scope subscriptions, which is why teardown needed
 * a generation counter: `files.set([])` re-entered `syncFileObservers()`
 * against a document that was being destroyed.
 */
export function wireFileObservers(): Disposer {
  const disposers = [
    files.subscribe(syncFileObservers),
    projectYjs.subscribe(syncFileObservers),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}
