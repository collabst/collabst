import { get, writable } from "svelte/store";
import type {
  EditorRuntimeState,
  EditorState,
  LeftPanelTab,
} from "./types";
import { filesApi } from "$lib/services/api";

const defaultEditorRuntimeState: EditorRuntimeState = {
  fileId: null,
  fileName: "",
  ytext: null,
  ydoc: null,
  provider: null,
  diagnostics: [],
  wrapLines: true,
  editable: true,
  theme: "light",
  editorElement: null,
  editorView: null,
  undoManager: null,
  commentTracker: null,
};

const defaultEditorState: EditorState = {
  projectId: "",
  leftPanelTab: "files",
  files: [],
  ...defaultEditorRuntimeState,
};

export type EditorContext = {
  subscribe: ReturnType<typeof writable<EditorState>>["subscribe"];
  set: ReturnType<typeof writable<EditorState>>["set"];
  update: ReturnType<typeof writable<EditorState>>["update"];
  cycleLeftPanelTab: (direction: 1 | -1) => void;
  setEditorRuntime: (runtime: Partial<EditorRuntimeState>) => void;
  setEditorElement: (editorElement: HTMLDivElement | null) => void;
  setEditorView: (editorView: EditorRuntimeState["editorView"]) => void;
  setUndoManager: (undoManager: EditorRuntimeState["undoManager"]) => void;
  setCommentTracker: (
    commentTracker: EditorRuntimeState["commentTracker"],
  ) => void;
  clearEditorRuntime: () => void;
};

function cycleLeftPanelTab(
  store: ReturnType<typeof writable<EditorState>>,
  direction: 1 | -1,
) {
  const tabs: LeftPanelTab[] = [
    "files",
    "search",
    "outline",
    "issues",
    "comments",
  ];
  const currentTab = get(store).leftPanelTab;
  const currentIndex = tabs.indexOf(currentTab);
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  store.update((state) => ({
    ...state,
    leftPanelTab: tabs[nextIndex],
  }));
}

function createEditorContext(initialState: EditorState): EditorContext {
  const store = writable<EditorState>(initialState);

  return {
    subscribe: store.subscribe,
    set: store.set,
    update: store.update,
    cycleLeftPanelTab: (direction: 1 | -1) =>
      cycleLeftPanelTab(store, direction),
    setEditorRuntime: (runtime: Partial<EditorRuntimeState>) => {
      store.update((state) => ({
        ...state,
        ...runtime,
      }));
    },
    setEditorElement: (editorElement) => {
      store.update((state) => ({
        ...state,
        editorElement,
      }));
    },
    setEditorView: (editorView) => {
      store.update((state) => ({
        ...state,
        editorView,
      }));
    },
    setUndoManager: (undoManager) => {
      store.update((state) => ({
        ...state,
        undoManager,
      }));
    },
    setCommentTracker: (commentTracker) => {
      store.update((state) => ({
        ...state,
        commentTracker,
      }));
    },
    clearEditorRuntime: () => {
      store.update((state) => ({
        ...state,
        ...defaultEditorRuntimeState,
      }));
    },
  };
}

export const editorContext = createEditorContext(defaultEditorState);

export async function initializeEditorContext(projectId: string) {
  const files = await filesApi.list(projectId);

  editorContext.set({
    ...defaultEditorState,
    projectId,
    files,
  });
}
