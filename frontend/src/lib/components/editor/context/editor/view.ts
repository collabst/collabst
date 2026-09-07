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
 * It owns `undoManager`, which `./commands` and `./extensions` reach through
 * `getUndoManager()` rather than by importing the binding (`PHASE2.md` §3.6).
 */

let undoManager: Y.UndoManager | null = null;

// A `Y.UndoManager` registers observers on the type it tracks and on the
// document itself; dropping the reference is not enough, so the one built for
// the previous file has to be destroyed before it is replaced — otherwise every
// file switch leaks a manager still listening on the file we left.
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
        // Get the coordinates of the selection
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

// The compiler entry point. `compile()` used to fall back to the literal
// "/main.typ", so a project whose entry point is named anything else never
// compiled. The choice is remembered per project, because it is a property of
// how the author works on that document, not of this browser session.
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
 * Bring the view up, and keep it in step with the element and the document.
 *
 * Three module-scope subscriptions until now (`PHASE2.md` §2.2). The
 * `editorElement` one is why `contextGeneration` exists: it awaits
 * `createExtensions()`, and the project can be torn down while it does.
 */
export function wireEditorView(): Disposer {
  const disposers = [
    view.subscribe(() => {
      setupSelectionListener();
    }),
    // The compiler entry point. `compile()` used to fall back to the literal
    // "/main.typ", so a project whose entry point is named anything else never
    // compiled. The choice is remembered per project, because it is a property
    // of how the author works on that document, not of this browser session.
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
