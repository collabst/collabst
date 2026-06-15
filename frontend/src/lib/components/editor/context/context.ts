// import { get, writable, type Writable } from "svelte/store";
// import type { EditorState, LeftPanelTab } from "./types";
// import { filesApi } from "$lib/services/api";
// import { auth } from "$lib/stores/auth";
// import { getWsUrl } from "$lib/utils/urls";
// import { createProjectYjs } from "$lib/yjs";
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

import { derived, get, writable } from "svelte/store";
import type { LeftPanelTab } from "./types";
import { type File } from "./types";
import * as Y from "yjs";
import { filesApi } from "$lib/services/api";
import { createProjectYjs, type YjsConnection } from "$lib/yjs";
import user from "@lucide/svelte/icons/user";
import { auth } from "$lib/stores/auth";

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

// export type EditorContext = {
//   subscribe: ReturnType<typeof writable<EditorState>>["subscribe"];
//   set: ReturnType<typeof writable<EditorState>>["set"];
//   update: ReturnType<typeof writable<EditorState>>["update"];
//   cycleLeftPanelTab: (direction: 1 | -1) => void;
//   selectFile: (fileId: string) => void;
//   initView: () => void;
// };

// function cycleLeftPanelTab(
//   store: ReturnType<typeof writable<EditorState>>,
//   direction: 1 | -1,
// ) {
//   const tabs: LeftPanelTab[] = [
//     "files",
//     "search",
//     "outline",
//     "issues",
//     "comments",
//   ];
//   const currentTab = get(store).leftPanelTab;
//   const currentIndex = tabs.indexOf(currentTab);
//   const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
//   store.update((state) => ({
//     ...state,
//     leftPanelTab: tabs[nextIndex],
//   }));
// }

// function loadCodeMirrorContent(store: ReturnType<typeof writable<EditorState>>) {
//   const ytext = get(store).ytext;
//   const view = get(store).view;
//   if (ytext && view) {
//     const newState = CMState.create({
//       doc: ytext.toString(),
//       extensions,
//     });
//     view.setState(newState);
//   }
// }

// function selectFile(store: ReturnType<typeof writable<EditorState>>, fileId: string) {
//   const file = get(store).files.find((f) => f.id === fileId);
//   if (file) {
//     store.update((state) => ({
//       ...state,
//       selectedFile: file,
//       ytext: state.ydoc?.getText(`file-${file.id}`) || null,
//     }));
//     loadCodeMirrorContent(store);
//   }
// }

// function initView(store: ReturnType<typeof writable<EditorState>>) {
//   const editorElement = get(store).editorElement;
//   const view = new EditorView({
//     doc: "",
//     parent: editorElement,
//     extensions,
//   });
//   store.update((state) => ({
//     ...state,
//     view,
//   }));
//   loadCodeMirrorContent(store);
// }

// export let editorContext: EditorContext;

// export async function initializeEditorContext(projectId: string) {
//   let store: Writable<EditorState>;

//   const token = get(auth).token;
//   const user = get(auth).user;

//   const files = await filesApi.list(projectId);
//   const selectedFile = files[0];

//   const projectYjs = createProjectYjs(projectId, user, token);
//   let ytext: Y.Text | null = null;
//   if (selectedFile) {
//     ytext = projectYjs.ydoc.getText(`file-${selectedFile.id}`);
//   }

//   const WS_URL = getWsUrl();

//   const wsUrl = new URL(`${WS_URL}/ws/project/${projectId}`);
//   if (token) {
//     wsUrl.searchParams.set('token', token);
//   }
//   let ws = new WebSocket(wsUrl.toString());

//   let pingInterval: number | null = null;
//   ws.onopen = () => {
//     pingInterval = window.setInterval(() => {
//       if (ws?.readyState === WebSocket.OPEN) {
//         console.log("Sending ping to keep WebSocket alive");
//         ws.send(JSON.stringify({ type: 'ping' }));
//       }
//     }, 30000)
//   }
//   ws.onmessage = (event) => {
//     try {
//       const message = JSON.parse(event.data);
//       console.log("Received WebSocket message:", message);
//     } catch (error) {
//       console.error("Failed to parse WebSocket message:", event.data);
//     }
//   };

//   let editorElement: HTMLDivElement | undefined = undefined;
//   store = writable<EditorState>({
//     projectId,
//     leftPanelTab: "files",
//     files,
//     selectedFile,
//     editorElement,
//     ydoc: projectYjs.ydoc,
//     ytext,
//     view: null,
//   });

//   editorContext = {
//     subscribe: store.subscribe,
//     set: store.set,
//     update: store.update,
//     cycleLeftPanelTab: (direction) => cycleLeftPanelTab(store, direction),
//     selectFile: (fileId) => selectFile(store, fileId),
//     initView: () => initView(store),
//   };
// }

export const projectId = writable<string>("");
export const leftPanelTab = writable<LeftPanelTab>("files");
export const files = writable<File[]>([]);
export const selectedFile = writable<File | null>(null);
export const editorElement = writable<HTMLDivElement | undefined>();
export const projectYjs = writable<YjsConnection | null>(null);
export const ydoc = derived(
  projectYjs,
  ($projectYjs) => $projectYjs?.ydoc || null,
);
export const view = writable<EditorView | null>(null);
export const ytext = derived([ydoc, selectedFile], ([$ydoc, $selectedFile]) => {
  return $ydoc?.getText(`file-${$selectedFile?.id}`);
});
export const previewIframe = writable<HTMLIFrameElement | undefined>();
export const context = {
  projectId,
  leftPanelTab,
  files,
  selectedFile,
  editorElement,
  ydoc,
  ytext,
  view,
  previewIframe,
};

export async function initContext(projectIdValue: string) {
  projectId.set(projectIdValue);
  files.set(await filesApi.list(projectIdValue));
  projectYjs.set(
    createProjectYjs(projectIdValue, get(auth).user, get(auth).token),
  );
  await loadTypst();
  await initSelectedFile();
}

export async function initSelectedFile() {
  const allFiles = get(files);
  const mainFile = allFiles.find((f) => f.path === "/main.typ");
  if (mainFile) {
    selectFile(mainFile.id);
    return;
  }

  if (allFiles.length > 0) {
    selectFile(allFiles[0].id);
  }
}

editorElement.subscribe((el) => {
  if (el) {
    view.update((v) => {
      if (v) {
        v.destroy();
      }
      return new EditorView({
        doc: "",
        parent: el,
        extensions,
      });
    });
  }
});

export function cycleLeftPanelTab(direction: 1 | -1) {
  const tabs: LeftPanelTab[] = [
    "files",
    "search",
    "outline",
    "issues",
    "comments",
  ];
  const currentTab = get(leftPanelTab);
  const currentIndex = tabs.indexOf(currentTab);
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  leftPanelTab.set(tabs[nextIndex]);
}

export function selectFile(fileId: string) {
  const file = get(files).find((f) => f.id === fileId);
  if (file) {
    selectedFile.set(file);
  }
}

ytext.subscribe((newYText) => {
  view.update((v) => {
    v?.setState(
      CMState.create({
        doc: newYText?.toString() || "",
        extensions,
      }),
    );
    return v;
  });
});


let typst: any = null;
let compiler: any = null;
let incrServer: any = null;
let initialized = false;

export async function loadTypst() {
  const module = await import(
    'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts/dist/esm/contrib/all-in-one-lite.bundle.js'
    // 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-all-in-one.ts@0.6.0/dist/esm/index.js'
  );

  typst = module.$typst;

  typst.setCompilerInitOptions({
    getModule: () =>
      'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
  });

  compiler = await typst.getCompiler();
  initialized = true;
  // compiler.withIncrementalServer((srv: any) => {
  //   incrServer = srv;
  //   initialized = true;
  //   self.postMessage({ type: 'initialized' });
  //   return () => {
  //     incrServer = null;
  //   };
  // });
}

export async function testCompile() {
  if (!initialized || !compiler) {
    throw new Error("Typst compiler is not initialized");
  }
  await reset();
  addFile('/main.typ', 'Hello, world!');
  const result = await compileTypst('/main.typ');
  sendVectorData(result.result, true);
}


export async function sendVectorData(vectorData: ArrayBuffer, isFirstCompile: boolean) {
  // Format message as the typst preview expects: "messageType,binaryData"
  const messageType = isFirstCompile ? 'new' : 'diff-v1';
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(messageType + ',');

  // Combine type and data
  const combined = new Uint8Array(typeBytes.length + vectorData.byteLength);
  combined.set(typeBytes, 0);
  combined.set(new Uint8Array(vectorData), typeBytes.length);

  // Send via postMessage to iframe
  // Note: We copy the buffer to avoid transferring ownership which would detach the original
  let $previewIframe = get(previewIframe);
  if (!$previewIframe) {
    console.error("Preview iframe is not available");
    return;
  }

  $previewIframe.contentWindow?.postMessage({
    type: 'typst-ws-message',
    data: combined.buffer.slice(0)
  }, '*');
}

export async function compileTypst(targetMainFilePath: string) {
  if (!initialized || !compiler) {
    throw new Error("Typst compiler is not initialized");
  }
  return compiler.compile({
    root: '/',
    mainFilePath: targetMainFilePath,
    // incrementalServer: incrServer,
    diagnostics: 'full',
  });
}

export async function addFile(path: string, content: string) {
  if (!compiler) return;
  console.log(`Adding file to compiler: ${path}`);
  await compiler.addSource(path, content);
}

export async function reset() {
  // if (incrServer) {
  //   await incrServer.reset();
  // }
  if (compiler) {
    await compiler.reset();
  }
}

export async function syncFiles() {
  if (!compiler) return;
  reset();
  const allFiles = get(files);
  for (const file of allFiles) {
    const content = get(projectYjs)?.ydoc.getText(`file-${file.id}`).toString() || '';
    await addFile(file.path, content);
  }
  const result = await compileTypst(get(selectedFile)?.path || '');
  sendVectorData(result.result, true);
}


selectedFile.subscribe((file) => {
  if (file === null) return;

  syncFiles();
});
