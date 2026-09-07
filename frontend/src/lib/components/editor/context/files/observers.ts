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
// The document the observers are attached to: file ids alone are not enough,
// since the `Y.Doc` can be swapped out under them without any id changing.
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

  for (const [fileId, unobserve] of fileObservers) {
    if (!filesValue.find((file) => file.id === fileId)) {
      unobserve();
      fileObservers.delete(fileId);
    }
  }

  for (const file of filesValue) {
    if (!fileObservers.has(file.id)) {
      const ytext = getFileText(ydocValue, file.id);
      if (ytext) {
        // Yjs fires observers synchronously, for a local edit from inside
        // yCollab's own `ViewPlugin.update()`. Dispatching again from there
        // throws and makes CodeMirror disable yCollab for the view, so the
        // work that dispatches is deferred past the in-flight update.
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

/** Keep the observers in step with the file list and the document they belong to. */
export function wireFileObservers(): Disposer {
  const disposers = [
    files.subscribe(syncFileObservers),
    projectYjs.subscribe(syncFileObservers),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}
