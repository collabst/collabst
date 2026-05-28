import type { Diagnostic } from "../types";
import type { Diagnostic as LintDiagnostic } from "@codemirror/lint";
import type { EditorView } from "codemirror";

export function convertDiagnosticsToLint(
  diagnostics: Diagnostic[],
  editorView: EditorView,
  currentFileName: string
): LintDiagnostic[] {
  const fileDiagnostics = diagnostics.filter(
    (d) => !d.path || d.path === currentFileName
  );

  return fileDiagnostics.map((d) => {
    let from = 0;
    let to = 0;

    if (d.range) {
      const doc = editorView.state.doc;
      const startLine = Math.max(1, d.range.start.line + 1);
      const endLine = Math.max(1, d.range.end.line + 1);

      if (startLine <= doc.lines && endLine <= doc.lines) {
        const startLineObj = doc.line(startLine);
        const endLineObj = doc.line(endLine);

        from = startLineObj.from + Math.max(0, d.range.start.character);
        to = endLineObj.from + Math.max(0, d.range.end.character);

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
