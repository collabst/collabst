import { canWrite, view } from "../state";
import { getUndoManager } from "./view";
import { indentLess, indentMore } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import { get } from "svelte/store";
/**
 * The verbs the toolbar and the keymap call: wrapping a selection in markup,
 * line prefixes for lists, and undo / redo against the Yjs undo manager.
 */

export function toggleWrap(prefix: string, suffix: string) {
  if (!get(canWrite)) return;
  const viewValue = get(view);
  if (!viewValue) return;

  const { from, to } = viewValue.state.selection.main;
  const selectedText = viewValue.state.doc.sliceString(from, to);

  // Check if we have text before and after selection
  const beforeStart = Math.max(0, from - prefix.length);
  const afterEnd = Math.min(viewValue.state.doc.length, to + suffix.length);
  const textBefore = viewValue.state.doc.sliceString(beforeStart, from);
  const textAfter = viewValue.state.doc.sliceString(to, afterEnd);

  // Check if already wrapped
  const isWrapped =
    textBefore.endsWith(prefix) && textAfter.startsWith(suffix);

  if (isWrapped) {
    // Remove wrapping
    if (selectedText) {
      // Selection exists - remove prefix before and suffix after
      // Changes array positions are relative to original document, CodeMirror handles adjustments
      viewValue.dispatch({
        changes: [
          { from: from - prefix.length, to: from, insert: "" },
          { from: to, to: to + suffix.length, insert: "" },
        ],
        selection: { anchor: from - prefix.length, head: to - prefix.length },
      });
    } else {
      // No selection, just cursor - remove prefix before and suffix after
      viewValue.dispatch({
        changes: [
          { from: from - prefix.length, to: from, insert: "" },
          { from: from, to: from + suffix.length, insert: "" },
        ],
        selection: { anchor: from - prefix.length },
      });
    }
  } else {
    // Add wrapping
    if (selectedText) {
      // Wrap selection
      viewValue.dispatch({
        changes: { from, to, insert: `${prefix}${selectedText}${suffix}` },
        selection: {
          anchor: from + prefix.length,
          head: from + prefix.length + selectedText.length,
        },
      });
    } else {
      // Insert prefix and suffix at cursor
      viewValue.dispatch({
        changes: { from, insert: `${prefix}${suffix}` },
        selection: { anchor: from + prefix.length },
      });
    }
  }
  viewValue.focus();
}

// The three inline-formatting commands, named once so the toolbar and the
// keymap cannot drift apart: both call these, neither knows the Typst markup.
export function toggleBold() {
  toggleWrap("*", "*");
}

export function toggleItalic() {
  toggleWrap("_", "_");
}

export function toggleUnderline() {
  toggleWrap("#underline[", "]");
}

// Undo/redo go through the Yjs `UndoManager`, not CodeMirror's history: the
// document is a shared type, so CodeMirror's own history would undo other
// people's edits. `undoManager` is rebuilt by the `ytext` derived store on every
// file switch, so read it at call time and never hold on to it.
export function undo() {
  if (!get(canWrite)) return false;
  if (!getUndoManager()?.canUndo()) return false;
  getUndoManager()!.undo();
  get(view)?.focus();
  return true;
}

export function redo() {
  if (!get(canWrite)) return false;
  if (!getUndoManager()?.canRedo()) return false;
  getUndoManager()!.redo();
  get(view)?.focus();
  return true;
}

// Line-structure counterpart of `toggleWrap`, for the list buttons: adds
// `prefix` to every line the selection touches, or strips it from all of them
// when they all already carry it. The prefix goes after the indentation so that
// nested list items keep their level.
export function toggleLinePrefix(prefix: string) {
  if (!get(canWrite)) return;
  const viewValue = get(view);
  if (!viewValue) return;

  const { state } = viewValue;
  const { from, to } = state.selection.main;
  const firstLineNumber = state.doc.lineAt(from).number;
  const lastLineNumber = state.doc.lineAt(to).number;

  const lines = [];
  for (let n = firstLineNumber; n <= lastLineNumber; n++) {
    lines.push(state.doc.line(n));
  }

  const indentLength = (text: string) => text.length - text.trimStart().length;
  const hasPrefix = (text: string) => text.slice(indentLength(text)).startsWith(prefix);

  // Blank lines are ignored on a multi-line selection: they are separators, not
  // list items. A single blank line (just a cursor) still gets the prefix.
  const targets = lines.length > 1
    ? lines.filter((line) => line.text.trim() !== "")
    : lines;
  if (targets.length === 0) return;

  const allPrefixed = targets.every((line) => hasPrefix(line.text));

  const changes = allPrefixed
    ? targets.map((line) => {
      const at = line.from + indentLength(line.text);
      return { from: at, to: at + prefix.length, insert: "" };
    })
    : targets
      .filter((line) => !hasPrefix(line.text))
      .map((line) => {
        const at = line.from + indentLength(line.text);
        return { from: at, to: at, insert: prefix };
      });

  if (changes.length === 0) return;

  viewValue.dispatch({ changes });
  viewValue.focus();
}

export function createUndoRedoKeymap() {
  if (!getUndoManager()) {
    return keymap.of([]);
  }

  return keymap.of([
    { key: "Mod-z", run: () => undo() },
    { key: "Mod-Shift-z", run: () => redo() },
    { key: "Mod-y", run: () => redo() },
    {
      key: "Mod-b",
      run: () => {
        toggleBold();
        return true;
      },
    },
    {
      key: "Mod-i",
      run: () => {
        toggleItalic();
        return true;
      },
    },
    {
      key: "Mod-u",
      run: () => {
        toggleUnderline();
        return true;
      },
    },
    {
      key: "Tab",
      run: (view) => {
        return indentMore(view);
      },
    },
    {
      key: "Shift-Tab",
      run: (view) => {
        return indentLess(view);
      },
    },
  ]);
}
