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
