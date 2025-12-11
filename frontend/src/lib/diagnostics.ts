import type { Diagnostic, DiagnosticRange } from "./types";
import type { Diagnostic as LintDiagnostic } from "@codemirror/lint";
import type { EditorView } from "codemirror";

export function parseRange(rangeStr: string | undefined): DiagnosticRange | undefined {
  if (!rangeStr || rangeStr === "") return undefined;

  // Format: "startLine:startChar-endLine:endChar" or "line:char"
  const match = rangeStr.match(/^(\d+):(\d+)(?:-(\d+):(\d+))?$/);
  if (!match) return undefined;

  const startLine = parseInt(match[1], 10);
  const startChar = parseInt(match[2], 10);
  const endLine = match[3] ? parseInt(match[3], 10) : startLine;
  const endChar = match[4] ? parseInt(match[4], 10) : startChar;

  return {
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  };
}

export function convertDiagnosticsToLint(
  diagnostics: Diagnostic[],
  editorView: EditorView | null,
  currentFileName: string
): LintDiagnostic[] {
  const fileDiagnostics = diagnostics.filter(
    (d) => !d.path || d.path === "/" + currentFileName
  );

  return fileDiagnostics.map((d) => {
    let from = 0;
    let to = 0;

    if (d.range && editorView) {
      const doc = editorView.state.doc;
      const startLine = Math.max(1, d.range.start.line);
      const endLine = Math.max(1, d.range.end.line);

      if (startLine <= doc.lines && endLine <= doc.lines) {
        const startLineObj = doc.line(startLine);
        const endLineObj = doc.line(endLine);

        from = startLineObj.from + Math.max(0, d.range.start.character + 1);
        to = endLineObj.from + Math.max(0, d.range.end.character + 1);

        from = Math.min(from, doc.length);
        to = Math.min(Math.max(from, to), doc.length);
      }
    }

    return {
      from,
      to,
      severity: d.severity,
      message: d.message,
    } as LintDiagnostic;
  });
}
