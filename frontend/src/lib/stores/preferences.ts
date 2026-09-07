import { writable, type Writable } from "svelte/store";

/**
 * Reader preferences for the editor page. Like the panel geometry in `./layout`,
 * they outlive one project. `wrapLines` is only persisted here; applying it to
 * the CodeMirror compartment stays in the editor context.
 */

function persistedBoolean(key: string, fallback: boolean): Writable<boolean> {
  const store = writable<boolean>(read());

  store.subscribe((value) => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Storage can be unavailable (private mode, quota); not remembered then.
    }
  });

  return store;

  function read(): boolean {
    if (typeof localStorage === "undefined") return fallback;
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? fallback : stored === "true";
    } catch {
      return fallback;
    }
  }
}

/** Whether the editor soft-wraps long lines. */
export const wrapLines = persistedBoolean("editor.wrapLines", true);

/** Whether the floating editor toolbar is drawn. */
export const showToolbar = persistedBoolean("editor.showToolbar", true);

/** Whether resolved threads stay in the comments panel. */
export const showResolvedComments = persistedBoolean(
  "editor.comments.showResolved",
  false,
);

export function toggleShowToolbar() {
  showToolbar.update((show) => !show);
}

export function toggleShowResolvedComments() {
  showResolvedComments.update((show) => !show);
}

export function toggleLineWrapping() {
  wrapLines.update((enabled) => !enabled);
}
