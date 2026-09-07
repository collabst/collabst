import { getFileText } from "$lib/yjs";
import { navigateTo } from "../editor/diagnostics";
import { ytext } from "../editor/view";
import {
  caseSensitiveSearch,
  files,
  projectYjs,
  regexSearch,
  replaceText,
  searchMatches,
  searchText,
  selectedFile,
  type Disposer,
  view,
  wholeWordSearch,
  ydoc,
} from "../state";
import type { File, FileSearchMatches, SearchMatch } from "../types";
import { search } from "@codemirror/search";
import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { get } from "svelte/store";

/**
 * Project-wide search: matching every file's Yjs text, replacing in one file or
 * all of them, and painting the current file's matches in the editor.
 */

/**
 * Recompute matches whenever the query or one of its modifiers changes.
 *
 * These four used to be module-scope subscriptions that ran from the moment the
 * module was imported and were never unsubscribed — see `PHASE2.md` §2.2. They
 * are now started by `initContext()` and stopped by `destroyContext()`, which
 * is what stops `searchText.set("")` during teardown from re-entering a search
 * over a half-reset world.
 */
export function wireSearch(): Disposer {
  const disposers = [
    searchText.subscribe(() => {
      updateSearchMatches();
    }),
    caseSensitiveSearch.subscribe(() => {
      updateSearchMatches();
    }),
    wholeWordSearch.subscribe(() => {
      updateSearchMatches();
    }),
    regexSearch.subscribe(() => {
      updateSearchMatches();
    }),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}

export function updateSearchMatches() {
  const searchTextValue = get(searchText);
  if (!searchTextValue) {
    searchMatches.set([]);
    updateMatchHighlights();
    return;
  }

  const matchesMap = [];
  const filesValue = get(files);
  const yjsConnection = get(projectYjs);
  if (!yjsConnection?.ydoc) {
    searchMatches.set([]);
    updateMatchHighlights();
    return;
  }

  for (const file of filesValue) {
    const ytext = getFileText(yjsConnection.ydoc, file.id);
    if (!ytext) continue;

    const query = get(searchText);
    const caseSensitive = get(caseSensitiveSearch);
    const wholeWord = get(wholeWordSearch);
    const regex = get(regexSearch);

    const content = ytext.toString();
    const matches = content.matchAll(
      new RegExp(
        regex
          ? query
          : wholeWord
            ? `\\b${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`
            : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        caseSensitive ? "g" : "gi",
      ),
    );
    const searchMatches: SearchMatch[] = [];

    matches.forEach((match) => {
      const startIndex = match.index || 0;
      const endIndex = startIndex + match[0].length;

      const startLine = content.substring(0, startIndex).split("\n").length - 1;
      const endLine = content.substring(0, endIndex).split("\n").length - 1;

      const startChar =
        content.substring(0, startIndex).split("\n").pop()?.length || 0;
      const endChar =
        content.substring(0, endIndex).split("\n").pop()?.length || 0;

      const endLineContent = content.split("\n")[endLine] || "";

      const extraStartIndex = Math.max(0, startIndex - startChar);
      const extraEndIndex = Math.min(content.length, endIndex + (endLineContent.length - endChar));

      let preMatchText = content.substring(extraStartIndex, startIndex);
      const matchText = content.substring(startIndex, endIndex);
      let postMatchText = content.substring(endIndex, extraEndIndex);

      searchMatches.push({
        filePath: file.path,
        startLine,
        startChar,
        startIndex,
        endLine,
        endChar,
        endIndex,
        preMatchText,
        matchText,
        postMatchText,
      });
    });

    if (searchMatches.length > 0) {
      matchesMap.push({ filePath: file.path, matches: searchMatches, collapsed: false });
    }
  }

  searchMatches.set(matchesMap);
  updateMatchHighlights();
}

// The search-match ranges that belong to the file currently open in the editor,
// clamped to `docLength` and stripped of empty ranges (a mark decoration may not
// be empty). Read both when the editor state is rebuilt from scratch — see
// `getHighlightExtensions()` — and when a new search result set is dispatched.
function selectedFileMatchRanges(docLength: number) {
  const selectedFileValue = get(selectedFile);
  if (!selectedFileValue) return [];

  const fileMatches = get(searchMatches).find(
    (m) => m.filePath === selectedFileValue.path,
  );
  if (!fileMatches) return [];

  return fileMatches.matches
    .map((match) => ({
      from: Math.min(match.startIndex, docLength),
      to: Math.min(match.endIndex, docLength),
    }))
    .filter(({ from, to }) => from < to);
}

function updateMatchHighlights() {
  const viewValue = get(view);
  if (!viewValue) return;

  viewValue.dispatch({
    effects: setMatchHighlights.of(
      selectedFileMatchRanges(viewValue.state.doc.length),
    ),
  });
}

export function gotoSearchMatch(match: SearchMatch) {
  const file = get(files).find((f) => f.path === match.filePath);
  if (!file) {
    console.warn("File not found for search match:", match.filePath);
    return;
  }
  selectedFile.set(file);
  setTimeout(() => { // TODO: this is a hack, needs to wait for editor to load the file content
    navigateTo(match.startIndex, match.endIndex);
  }, 100);
}

export function replaceSearchMatch(match: SearchMatch) {
  const file = get(files).find((f) => f.path === match.filePath);
  const ydoc = get(projectYjs)?.ydoc;
  if (!file || !ydoc) return;

  const ytext = ydoc.getText(`file-${file.id}`);
  ytext.delete(match.startIndex, match.endIndex - match.startIndex);
  ytext.insert(match.startIndex, get(replaceText));
}

export function replaceAllInFile(filePath: string) {
  const file = get(files).find((f) => f.path === filePath);
  const ydoc = get(projectYjs)?.ydoc;
  if (!file || !ydoc) return;

  const query = get(searchText);
  const replace = get(replaceText);
  const regex = get(regexSearch)
  const caseSensitive = get(caseSensitiveSearch);
  const wholeWord = get(wholeWordSearch);

  const text = getFileText(ydoc, file.id)?.toString() || "";
  const newText = text.replace(
    new RegExp(
      regex
        ? query
        : wholeWord
          ? `\\b${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`
          : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      caseSensitive ? "g" : "gi",
    ),
    replace,
  );
  const ytext = ydoc.getText(`file-${file.id}`);
  ytext.delete(0, ytext.length);
  ytext.insert(0, newText);
}

export function replaceAllMatches() {
  for (const file of get(files)) {
    replaceAllInFile(file.path);
  }
}



const setMatchHighlights = StateEffect.define<{ from: number; to: number }[]>();

const matchHighlight = Decoration.mark({
  class: "search-match"
});

export function getHighlightExtensions() {
  const matchHighlightField = StateField.define({
    // Seeded from `searchMatches`, not empty: this field is re-created on every
    // `setState` (file switch, theme/settings change) and on every new view, and
    // the highlights must survive those rebuilds.
    create(state) {
      return Decoration.set(
        selectedFileMatchRanges(state.doc.length).map(({ from, to }) =>
          matchHighlight.range(from, to),
        ),
      );
    },

    update(decorations, tr) {
      decorations = decorations.map(tr.changes);

      for (const effect of tr.effects) {
        if (effect.is(setMatchHighlights)) {
          decorations = Decoration.set(
            effect.value.map(({ from, to }) =>
              matchHighlight.range(from, to)
            )
          );
        }
      }

      return decorations;
    },

    provide: field => EditorView.decorations.from(field)
  });
  return [matchHighlightField];
}

export function toggleFileCollapsed(fileMatches: FileSearchMatches) {
  searchMatches.update((files) =>
    files.map((file) =>
      file.filePath === fileMatches.filePath
        ? { ...file, collapsed: !file.collapsed }
        : file
    )
  );
}
