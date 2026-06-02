import { get, writable, type Writable } from "svelte/store";
import type { EditorState, LeftPanelTab } from "./types";
import { filesApi } from "$lib/services/api";
import { auth } from "$lib/stores/auth";
import { getWsUrl } from "$lib/utils/urls";
import { createProjectYjs } from "$lib/yjs";
import { EditorState as CMState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  highlightSpecialChars,
  drawSelection,
  highlightActiveLine,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  lineNumbers,
  highlightActiveLineGutter,
} from "@codemirror/view";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";


const extensions = [
  // A line number gutter
  lineNumbers(),
  // A gutter with code folding markers
  foldGutter(),
  // Replace non-printable characters with placeholders
  highlightSpecialChars(),
  // The undo history
  history(),
  // Replace native cursor/selection with our own
  drawSelection(),
  // Show a drop cursor when dragging over the editor
  dropCursor(),
  // Allow multiple cursors/selections
  CMState.allowMultipleSelections.of(true),
  // Re-indent lines when typing specific input
  indentOnInput(),
  // Highlight syntax with a default style
  syntaxHighlighting(defaultHighlightStyle),
  // Highlight matching brackets near cursor
  bracketMatching(),
  // Automatically close brackets
  closeBrackets(),
  // Load the autocompletion system
  autocompletion(),
  // Allow alt-drag to select rectangular regions
  rectangularSelection(),
  // Change the cursor to a crosshair when holding alt
  crosshairCursor(),
  // Style the current line specially
  highlightActiveLine(),
  // Style the gutter for current line specially
  highlightActiveLineGutter(),
  // Highlight text that matches the selected text
  highlightSelectionMatches(),
  keymap.of([
    // Closed-brackets aware backspace
    ...closeBracketsKeymap,
    // A large set of basic bindings
    ...defaultKeymap,
    // Search-related keys
    ...searchKeymap,
    // Redo/undo keys
    ...historyKeymap,
    // Code folding bindings
    ...foldKeymap,
    // Autocompletion keys
    ...completionKeymap,
    // Keys related to the linter system
    ...lintKeymap,
  ]),
];

export type EditorContext = {
  subscribe: ReturnType<typeof writable<EditorState>>["subscribe"];
  set: ReturnType<typeof writable<EditorState>>["set"];
  update: ReturnType<typeof writable<EditorState>>["update"];
  cycleLeftPanelTab: (direction: 1 | -1) => void;
  selectFile: (fileId: string) => void;
  initView: () => void;
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

function selectFile(store: ReturnType<typeof writable<EditorState>>, fileId: string) {
  const file = get(store).files.find((f) => f.id === fileId);
  if (file) {
    const ytext = get(store).ydoc?.getText(`file-${file.id}`) || null;
    const newState = CMState.create({
      doc: ytext?.toString() || "",
      extensions,
    });
    const view = get(store).view;
    view?.setState(newState);
    store.update((state) => ({
      ...state,
      selectedFile: file,
      ytext,
    }));
  }
}

function initView(store: ReturnType<typeof writable<EditorState>>) {
  const editorElement = get(store).editorElement;
  const ytext = get(store).ytext;
  const view = new EditorView({
    doc: ytext?.toString() || "",
    parent: editorElement,
    extensions,
  });

  store.update((state) => ({
    ...state,
    view,
  }));
}

export let editorContext: EditorContext;

export async function initializeEditorContext(projectId: string) {
  let store: Writable<EditorState>;

  const token = get(auth).token;
  const user = get(auth).user;

  const files = await filesApi.list(projectId);

  const projectYjs = createProjectYjs(projectId, user, token);
  const ytext = projectYjs.ydoc.getText(`file-${files[0]?.id}`);

  const WS_URL = getWsUrl();

  const wsUrl = new URL(`${WS_URL}/ws/project/${projectId}`);
  if (token) {
    wsUrl.searchParams.set('token', token);
  }
  let ws = new WebSocket(wsUrl.toString());

  let pingInterval: number | null = null;
  ws.onopen = () => {
    pingInterval = window.setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        console.log("Sending ping to keep WebSocket alive");
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000)
  }
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Received WebSocket message:", message);
    } catch (error) {
      console.error("Failed to parse WebSocket message:", event.data);
    }
  };

  let editorElement: HTMLDivElement | undefined = undefined;

  store = writable<EditorState>({
    projectId,
    leftPanelTab: "files",
    files,
    selectedFile: files[0],
    editorElement,
    ydoc: projectYjs.ydoc,
    ytext,
    view: null,
  });

  editorContext = {
    subscribe: store.subscribe,
    set: store.set,
    update: store.update,
    cycleLeftPanelTab: (direction) => cycleLeftPanelTab(store, direction),
    selectFile: (fileId) => selectFile(store, fileId),
    initView: () => initView(store),
  };
}
