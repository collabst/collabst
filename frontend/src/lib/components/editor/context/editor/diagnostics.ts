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
    selectedFile.set(diagnosticFile);
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

// Headings of the open document, for the outline tab. A regex over the Yjs text
// rather than the syntax tree: one pass, and cheap. Fenced raw blocks are
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
      // Two sections can share a title, so the line number is the stable key.
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

// `formatNumber` reads `errorLines` at render time, so the Set holds the open
// file's lines only — filtered by the same path rule `convertDiagnosticsToLint`
// uses, so the gutter and the lint underlines agree. The reconfigure redraws it.
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

/** Recompute the outline and the error gutter as the document and open file change. */
export function wireDiagnostics(): Disposer {
  const disposers = [
    // A file switch swaps the `Y.Text`; edits come through the file observers.
    ytext.subscribe(() => updateOutline()),
    selectedFile.subscribe(() => updateOutline()),
    // Diagnostics outlive a file switch, so the new file's gutter needs a
    // recompute even though nothing was compiled.
    selectedFile.subscribe(() => {
      updateErrorLines();
    }),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}
