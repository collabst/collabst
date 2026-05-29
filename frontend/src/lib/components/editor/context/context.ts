import { get, writable } from "svelte/store";
import type { File } from "./types";
import { filesApi } from "$lib/services/api";

export type LeftPanelTab =
  | "files"
  | "search"
  | "outline"
  | "issues"
  | "comments";

export type EditorState = {
  projectId: string;
  leftPanelTab: LeftPanelTab;
  files: File[];
};

export type EditorContext = {
  subscribe: ReturnType<typeof writable<EditorState>>["subscribe"];
  set: ReturnType<typeof writable<EditorState>>["set"];
  update: ReturnType<typeof writable<EditorState>>["update"];
  cycleLeftPanelTab: (direction: 1 | -1) => void;
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
  };
}

export async function initializeEditorContext(projectId: string) {
  const files = await filesApi.list(projectId);

  editorContext = createEditorContext({
    projectId,
    leftPanelTab: "files",
    files,
  });
}

export let editorContext: EditorContext;
