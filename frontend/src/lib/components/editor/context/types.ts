import type { EditorView } from "codemirror";
import type { Diagnostic } from "$lib/types";
import type { CommentRangeTracker } from "$lib/codemirror/comments";
import type { WebsocketProvider } from "y-websocket";
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

export type EditorRuntimeState = {
  fileId: string | null;
  fileName: string;
  ytext: Y.Text | null;
  ydoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  diagnostics: Diagnostic[];
  wrapLines: boolean;
  editable: boolean;
  theme: EditorTheme;
  editorElement: HTMLDivElement | null;
  editorView: EditorView | null;
  undoManager: Y.UndoManager | null;
  commentTracker: CommentRangeTracker | null;
};

export type EditorState = {
  projectId: string;
  leftPanelTab: LeftPanelTab;
  files: File[];
} & EditorRuntimeState;
