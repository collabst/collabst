import { writable, type Writable } from "svelte/store";

/**
 * Reader preferences for the editor page.
 *
 * Like the panel geometry in `./layout`, these outlive one project: the context
 * used to own them and had to remember not to reset them in `destroyContext()`.
 * Each keeps the `localStorage` key the old editor already used, so a reader's
 * existing preferences survive this move.
 *
 * `wrapLines` is only *persisted* here. Applying it to the editor — reconfiguring
 * the CodeMirror line-wrapping compartment — stays in the editor context, which
 * subscribes to this store.
 */

function persistedBoolean(key: string, fallback: boolean): Writable<boolean> {
  const store = writable<boolean>(read());

  store.subscribe((value) => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Storage can be unavailable (private mode, quota); the preference is
      // then simply not remembered across reloads.
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
