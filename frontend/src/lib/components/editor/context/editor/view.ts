import { getSelection, syncCommentDecorations } from "../comments";
import { getContextGeneration } from "../lifecycle";
import {
  commentButtonPosition,
  comments,
  editorElement,
  files,
  leftPanelTab,
  outline,
  selectedFile,
  showCommentButton,
  type Disposer,
  view,
  ydoc,
} from "../state";
import type { LeftPanelTab } from "../types";
import { createExtensions } from "./extensions";
import { search } from "@codemirror/search";
import { EditorState as CMState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { derived, get } from "svelte/store";
import * as Y from "yjs";
/**
 * The editor view's own lifetime: creating it once the element and the Yjs text
 * are both there, rebuilding its state when the open file changes, and the
 * selection listener behind the floating comment button.
 *
 * It owns `undoManager`, which other modules reach through `getUndoManager()`.
 */

let undoManager: Y.UndoManager | null = null;

// A `Y.UndoManager` observes the type and the document, so the previous file's
// manager has to be destroyed rather than merely dropped.
export function setUndoManager(next: Y.UndoManager | null) {
  undoManager?.destroy();
  undoManager = next;
}

export const ytext = derived([ydoc, selectedFile], ([$ydoc, $selectedFile]) => {
  const ytextValue = $ydoc?.getText(`file-${$selectedFile?.id}`);
  setUndoManager(ytextValue ? new Y.UndoManager(ytextValue) : null);
  return ytextValue;
});

let disposeSelectionListener: (() => void) | null = null;

function setupSelectionListener() {
  if (disposeSelectionListener) {
    disposeSelectionListener();
    disposeSelectionListener = null;
  }

  const viewValue = get(view);
  if (!viewValue) return;
  const editorDom = viewValue.dom;

  const handleSelectionChange = () => {
    setTimeout(() => {
      const selection = getSelection();
      if (
        selection &&
        selection.from !== selection.to &&
        selection.text.trim()
      ) {
        const coords = viewValue.coordsAtPos(selection.to);
        if (coords) {
          const containerRect = viewValue.dom.getBoundingClientRect();
          showCommentButton.set(true);
          commentButtonPosition.set({
            top: coords.top - containerRect.top + 20,
            left: coords.left - containerRect.left,
          });
        }
      } else {
            }
    }, 10);
  };

  editorDom.addEventListener("mouseup", handleSelectionChange);
  editorDom.addEventListener("mousedown", handleSelectionChange);
  editorDom.addEventListener("keyup", handleSelectionChange);
  editorDom.addEventListener("keydown", handleSelectionChange);

  disposeSelectionListener = () => {
    editorDom.removeEventListener("mouseup", handleSelectionChange);
    editorDom.removeEventListener("mousedown", handleSelectionChange);
    editorDom.removeEventListener("keyup", handleSelectionChange);
    editorDom.removeEventListener("keydown", handleSelectionChange);
  };
}

export function cycleLeftPanelTab(direction: 1 | -1) {
  const tabs: LeftPanelTab[] = [
    "files",
    "search",
    "outline",
    "issues",
    "comments",
  ];
  const currentTab = get(leftPanelTab);
  const currentIndex = tabs.indexOf(currentTab);
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  leftPanelTab.set(tabs[nextIndex]);
}

async function updateEditorContent() {
  const viewValue = get(view);
  const ytextValue = get(ytext);
  if (!viewValue || !ytextValue) return;

  const extensions = await createExtensions();
  viewValue.setState(
    CMState.create({
      doc: ytextValue.toString(),
      extensions,
    }),
  );
  // `setState` recreates `commentField`, which starts at `Decoration.none`, so
  // the comment highlights have to be re-applied to the rebuilt state.
  syncCommentDecorations();
}

/**
 * Bring the view up, and keep it in step with the element and the document. The
 * `editorElement` subscription awaits `createExtensions()`, so it checks the
 * context generation: the project can be torn down while it waits.
 */
export function wireEditorView(): Disposer {
  const disposers = [
    view.subscribe(() => {
      setupSelectionListener();
    }),
    editorElement.subscribe(async (el) => {
      if (!el) return;
      const generation = getContextGeneration();
      const extensions = await createExtensions();
      if (generation !== getContextGeneration()) return;
      const ytextValue = get(ytext);
      view.update((v) => {
        if (v) {
          v.destroy();
        }
        return new EditorView({
          doc: ytextValue?.toString() ?? "",
          parent: el,
          extensions,
        });
      });
    }),
    ytext.subscribe(async () => {
      updateEditorContent();
    }),
  ];
  return () => {
    for (const dispose of disposers) dispose();
    disposeSelectionListener?.();
    disposeSelectionListener = null;
  };
}

/** The Yjs undo manager for the open file, or `null` between files. */
export function getUndoManager(): Y.UndoManager | null {
  return undoManager;
}
