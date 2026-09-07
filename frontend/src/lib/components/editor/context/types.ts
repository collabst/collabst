import type { FileTreeNode } from "$lib/types";
import type { EditorView } from "codemirror";
import type * as Y from "yjs";

export interface File {
  id: string;
  project_id: string;
  name: string;
  path: string;
  parent_id: string | null;
  is_folder: boolean;
  created_at: string;
  updated_at: string;
}

export type LeftPanelTab =
  | "files"
  | "search"
  | "outline"
  | "issues"
  | "comments";

export type EditorTheme = "light" | "dark";

export type EditorState = {
  projectId: string;
  leftPanelTab: LeftPanelTab;
  files: File[];
  selectedFile: File;
  editorElement: HTMLDivElement | undefined;
  ydoc: Y.Doc | null;
  ytext: Y.Text | null;
  view: EditorView | null;
};

// --- Moved here so that `state.ts` can name them ------------------------------
//
// They belong by subject to the modules that use them, but `state.ts` declares
// stores of these types and may not import a behaviour module at all.

/** A row in the file explorer: a file or an asset, in tree shape. */
export type ExplorerNode = FileTreeNode & { kind: "file" | "asset" };

/** Where the file context menu is open, and on what. `null` node = project root. */
export interface FileMenuState {
  node: ExplorerNode | null;
  x: number;
  y: number;
}

/** The row the delete confirmation is asking about. */
export interface PendingDeletion {
  id: string;
  name: string;
  kind: "file" | "asset";
  isFolder: boolean;
}

/** One hit in the global search panel, with the text around it for the preview. */
export interface SearchMatch {
  filePath: string;
  startLine: number;
  startChar: number;
  startIndex: number;
  endLine: number;
  endChar: number;
  endIndex: number;
  preMatchText: string;
  matchText: string;
  postMatchText: string;
}

/** The hits in one file, grouped under a collapsible header. */
export interface FileSearchMatches {
  filePath: string;
  collapsed: boolean;
  matches: SearchMatch[];
}

/** A comment being composed, before it is posted. */
export interface CommentDraft {
  text: string;
  range: { from: number; to: number };
  selectedText: string;
}

/** One heading of the open document, for the outline tab. */
export interface OutlineEntry {
  id: string;
  level: number;
  title: string;
  line: number;
}
