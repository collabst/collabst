export interface DiagnosticRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface Diagnostic {
  severity: string;
  message: string;
  range?: DiagnosticRange;
  path?: string;
  package?: string;
}

export interface VirtualFile {
  name: string;
  content: string;
  isFolder: boolean;
  children?: VirtualFile[];
  expanded?: boolean;
}

export interface SemanticTokenLegend {
  tokenTypes: string[];
  tokenModifiers: string[];
}
