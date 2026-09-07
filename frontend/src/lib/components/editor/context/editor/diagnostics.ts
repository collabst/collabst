import { convertDiagnosticsToLint, parseRange } from "$lib/preview/diagnostics";
import { type Diagnostic } from "$lib/types";
import {
  diagnostics,
  files,
  outline,
  selectedFile,
  type Disposer,
  view,
} from "../state";
import type { OutlineEntry } from "../types";
import { reconfigureLineNumbers } from "./extensions";
import { ytext } from "./view";
import { setDiagnostics } from "@codemirror/lint";
import { get } from "svelte/store";
/**
 * What the compiler said: the lint gutter, the error lines the icon plugin
 * paints, the issues panel's navigation, and the document outline.
 */

let errorLines = new Set<number>();

/** Read by `./extensions`, which paints them into the line-number gutter. */
export function getErrorLines(): ReadonlySet<number> {
  return errorLines;
}

function updateLinter() {
  const editorView = get(view);
  if (editorView) {
    const lintDiagnostics = convertDiagnosticsToLint(
      get(diagnostics),
      editorView,
      get(selectedFile)?.path || "",
    );
    const transaction = setDiagnostics(editorView.state, lintDiagnostics);
    editorView.dispatch(transaction);
  }
}

export function navigateTo(
  from: number | [number, number],
  to?: number | [number, number],
) {
  const viewValue = get(view);
  if (!viewValue) return;

  const doc = viewValue.state.doc;

  if (from instanceof Array) {
    const [startLine, startChar] = from;

    const startLineNum = Math.max(1, startLine);
    if (startLineNum > doc.lines) return;

    const startLineObj = doc.line(startLineNum);
    from = startLineObj.from + Math.max(0, startChar);
  }

  if (to instanceof Array) {
    const [endLine, endChar] = to;

    const endLineNum = Math.max(1, endLine);
    if (endLineNum > doc.lines) return;

    const endLineObj = doc.line(endLineNum);
    to = endLineObj.from + Math.max(0, endChar);
  }

  viewValue.dispatch({
    selection: { anchor: from, head: to ?? from },
    scrollIntoView: true,
  });
  viewValue.focus();
}

export function gotoDiagnostic(diagnostic: Diagnostic) {
  if (!diagnostic.range) return;

  // Find the file by path
  const diagnosticFile = get(files).find((f) => {
    const filePath = f.path.startsWith("/") ? f.path.slice(1) : f.path;
    const diagnosticPath = diagnostic.path
      ? diagnostic.path.startsWith("/")
        ? diagnostic.path.slice(1)
        : diagnostic.path
      : "";
    return filePath === diagnosticPath || f.name === diagnostic.path;
  });

  if (diagnosticFile) {
    // Select the file
    selectedFile.set(diagnosticFile);
  
    // Navigate to the diagnostic in the editor
    setTimeout(() => {
      navigateTo(
        [diagnostic.range!.start.line + 1,
        diagnostic.range!.start.character],
        [diagnostic.range!.end.line + 1,
        diagnostic.range!.end.character]
      );
    }, 100);
  }
}

// --- Outline -----------------------------------------------------------------

// Headings of the open document, for the outline tab. Parsed with a regex over
// the Yjs text rather than the syntax tree: it is one pass, it costs nothing,
// and the previous editor had no outline at all, so a first version that is
// occasionally too eager still beats an empty panel. Fenced raw blocks are
// skipped, because a `=` inside one is not a heading.
const HEADING_PATTERN = /^(=+)\s+(.*\S)\s*$/;

function parseOutline(text: string): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  let inRawBlock = false;

  text.split("\n").forEach((rawLine, index) => {
    const line = rawLine.trimStart();
    if (line.startsWith("```")) {
      inRawBlock = !inRawBlock;
      return;
    }
    if (inRawBlock) return;

    const match = HEADING_PATTERN.exec(line);
    if (!match) return;
    entries.push({
      // The line number is what makes an entry unique: two sections can share a
      // title, and `{#each}` needs a stable key.
      id: `${index + 1}`,
      level: match[1].length,
      title: match[2],
      line: index + 1,
    });
  });

  return entries;
}

export function updateOutline() {
  const fileName = get(selectedFile)?.name ?? "";
  // Only Typst documents have Typst headings.
  if (!fileName.toLowerCase().endsWith(".typ")) {
    outline.set([]);
    return;
  }
  outline.set(parseOutline(get(ytext)?.toString() ?? ""));
}


export function gotoOutlineEntry(entry: OutlineEntry) {
  navigateTo([entry.line, 0]);
}

// `getLineNumbersExtension()`'s `formatNumber` reads `errorLines` at render
// time, so the Set must hold the *open* file's error lines only. `diagnostics`
// covers the whole project, hence the path filter — the same one
// `convertDiagnosticsToLint` uses, so gutter and lint underlines always agree.
// The reconfigure is what forces the gutter to redraw with the new Set.
function updateErrorLines() {
  const currentPath = get(selectedFile)?.path || "";
  errorLines = new Set(
    get(diagnostics)
      .filter((d) => d.severity === "error" && d.range && (!d.path || d.path === currentPath))
      .map((d) => d.range!.start.line + 1),
  );

  const viewValue = get(view);
  if (!viewValue) return;
  reconfigureLineNumbers(viewValue);
}


export function onDiagnostics(diags: any[] = []) {
  // Parse diagnostics range from compiler format
  diagnostics.set(
    diags.map((d: any) => ({
      severity: d.severity,
      message: d.message,
      range: parseRange(d.range),
      path: d.path,
    }))
  );
  updateErrorLines();
  updateLinter();
}


// The server is the source of truth for the file tree, and the projectSync WS
// echoes every mutation back to the client that made it (the REST handlers
// broadcast without a `sender`, so nobody is excluded). Rename / move / delete
// therefore never touch the `files` / `assets` stores here: `onFileUpdated` &co.
// do it. Only the create paths update locally, because the caller needs the
// created row straight away — and the server may have renamed it.

/**
 * Recompute the outline and the error gutter as the document and the open file
 * change. Three module-scope subscriptions until now (`PHASE2.md` §2.2).
 */
export function wireDiagnostics(): Disposer {
  const disposers = [
    // A file switch swaps the `Y.Text`; edits are picked up by the file observers,
    // which call this for the open file only.
    ytext.subscribe(() => updateOutline()),
    selectedFile.subscribe(() => updateOutline()),
    // Diagnostics outlive a file switch, so the gutter of the newly opened file has
    // to be recomputed even though no new compile has happened.
    selectedFile.subscribe(() => {
      updateErrorLines();
    }),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}
