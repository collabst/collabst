import {
  canWrite,
  findCaseSensitive,
  findMatchCount,
  findMatchIndex,
  findOpen,
  findQuery,
  findRegex,
  findReplace,
  findWholeWord,
  type Disposer,
  view,
} from "../state";
import {
  SearchQuery,
  findNext as findNextCommand,
  findPrevious as findPreviousCommand,
  replaceAll as replaceAllCommand,
  replaceNext as replaceNextCommand,
  search,
  selectMatches as selectMatchesCommand,
  setSearchQuery,
} from "@codemirror/search";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { derived, get } from "svelte/store";
/**
 * Find (and replace) inside the open document.
 *
 * Distinct from the global search panel in `../search`, which greps every
 * file's Yjs text. This one drives CodeMirror's own search state, so the
 * component stays presentational: it binds the stores and calls the verbs.
 */

function buildFindQuery() {
  return new SearchQuery({
    search: get(findQuery),
    replace: get(findReplace),
    caseSensitive: get(findCaseSensitive),
    wholeWord: get(findWholeWord),
    regexp: get(findRegex),
  });
}

// "3 of 17": the count comes from walking the query's own cursor, and the index
// from whichever match the selection is currently sitting on (0 = none).
function refreshFindMatches() {
  const viewValue = get(view);
  const query = buildFindQuery();
  if (!viewValue || !query.valid) {
    findMatchCount.set(0);
    findMatchIndex.set(0);
    return;
  }

  const selection = viewValue.state.selection.main;
  let count = 0;
  let index = 0;
  try {
    const cursor = query.getCursor(viewValue.state);
    for (let step = cursor.next(); !step.done; step = cursor.next()) {
      count += 1;
      if (step.value.from === selection.from && step.value.to === selection.to) {
        index = count;
      }
    }
  } catch {
    // An in-progress regular expression can throw; treat it as "no matches".
    count = 0;
    index = 0;
  }

  findMatchCount.set(count);
  findMatchIndex.set(index);
}

function applyFindQuery() {
  const viewValue = get(view);
  if (!viewValue) return;
  viewValue.dispatch({ effects: setSearchQuery.of(buildFindQuery()) });
  refreshFindMatches();
}

export function openFind() {
  findOpen.set(true);
  applyFindQuery();
}

export function closeFind() {
  findOpen.set(false);
  get(view)?.focus();
}

export function findNextMatch() {
  const viewValue = get(view);
  if (!viewValue) return;
  findNextCommand(viewValue);
  refreshFindMatches();
}

export function findPreviousMatch() {
  const viewValue = get(view);
  if (!viewValue) return;
  findPreviousCommand(viewValue);
  refreshFindMatches();
}

export function selectAllFindMatches() {
  const viewValue = get(view);
  if (!viewValue) return;
  selectMatchesCommand(viewValue);
}

export function replaceFindMatch() {
  if (!get(canWrite)) return;
  const viewValue = get(view);
  if (!viewValue) return;
  replaceNextCommand(viewValue);
  refreshFindMatches();
}

export function replaceAllFindMatches() {
  if (!get(canWrite)) return;
  const viewValue = get(view);
  if (!viewValue) return;
  replaceAllCommand(viewValue);
  refreshFindMatches();
}

// `Prec.highest` because `basicSetup` brings `searchKeymap`, whose own `Mod-f`
// would otherwise open CodeMirror's default panel instead of ours.
export function createFindKeymap() {
  return Prec.highest(
    keymap.of([
      {
        key: "Mod-f",
        run: () => {
          openFind();
          return true;
        },
      },
      {
        key: "Escape",
        run: () => {
          // Returning false when the panel is closed lets whatever else is
          // bound to Escape (autocompletion, for one) have it.
          if (!get(findOpen)) return false;
          closeFind();
          return true;
        },
      },
    ]),
  );
}

/** Re-run the query whenever it or one of its modifiers changes. */
export function wireFind(): Disposer {
  return derived(
    [findQuery, findReplace, findCaseSensitive, findWholeWord, findRegex],
    (values) => values,
  ).subscribe(() => applyFindQuery());
}
