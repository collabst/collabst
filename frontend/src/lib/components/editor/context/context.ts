import { EditorState as CMState, Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import {
  indentOnInput,
  bracketMatching,
  foldGutter,
  indentUnit,
} from "@codemirror/language";
import {
  indentLess,
  indentMore,
  selectAll as selectAllCommand,
  toggleBlockComment as toggleBlockCommentCommand,
  toggleLineComment as toggleLineCommentCommand,
} from "@codemirror/commands";
import {
  closeBrackets,
} from "@codemirror/autocomplete";
import { setDiagnostics } from "@codemirror/lint";

import { derived, get, writable, type Writable } from "svelte/store";
import type { LeftPanelTab } from "./types";
import { type File } from "./types";
import { assetsApi, commentsApi, filesApi, projectsApi, usersApi } from "$lib/services/api";
import { createProjectYjs, getFileText, type YjsConnection } from "$lib/yjs";
import { auth } from "$lib/stores/auth";
import { createProjectSync } from "$lib/projectSync";
import type { Asset, CommentThreadDTO, Project, Comment, CommentReplyDTO, Diagnostic, UserProfile } from "$lib/types";
import { cacheAsset, getCachedAsset, removeCachedAsset } from "$lib/utils/assetCache";
import { notifications } from "$lib/stores/notifications";
import { goto } from "$app/navigation";
import { createCommentSync } from "$lib/commentSync";
import { tick } from "svelte";
import { basicSetup } from "codemirror";
import { greyDarkSyntax, greyDarkTheme, greyLightSyntax, greyLightTheme } from "$lib/codemirror/greyTheme";
import { theme } from "$lib/stores/theme";
import { editorSettings } from "$lib/stores/editorSettings";
import { yCollab } from "y-codemirror.next";
import * as Y from "yjs";
import {
  commentsExtension,
  setActiveCommentEffect,
  updateCommentsEffect,
} from "$lib/codemirror/comments";
import { convertDiagnosticsToLint, parseRange } from "$lib/preview/diagnostics";

const themeCompartment = new Compartment();
const syntaxCompartment = new Compartment();
const lineWrappingCompartment = new Compartment();
const languageCompartment = new Compartment();
const editorStyleCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const ligaturesCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const editableCompartment = new Compartment();
const highlightCompartement = new Compartment();


// Line wrapping is a reader preference, not project state: it is remembered in
// `localStorage` under the key the old editor already used, and deliberately
// left alone by `destroyContext()` so it survives from one project to the next.
const WRAP_LINES_STORAGE_KEY = "editor.wrapLines";

function readStoredWrapLines(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const stored = localStorage.getItem(WRAP_LINES_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export const wrapLines = writable<boolean>(readStoredWrapLines());
let errorLines = new Set<number>();

function getLineWrappingExtensions() {
  return get(wrapLines) ? [EditorView.lineWrapping] : [];
}

function getLineNumbersExtension() {
  return lineNumbers({
    formatNumber: (lineNo) => {
      // Show × symbol instead of line number for lines with errors
      if (errorLines.has(lineNo)) {
        return "×";
      }
      return String(lineNo);
    },
    domEventHandlers: {
      // Add data-error attribute to gutter elements with errors
    },
  });
}

function getThemeExtensions() {
  return get(theme) === "light" ? [greyLightTheme] : [greyDarkTheme];
}

async function getSyntaxHighlighting() {
  const currentTheme = get(theme);
  const fileName = get(selectedFile)?.name || "";
  const extension = fileName.split(".").pop()?.toLowerCase();

  // For Typst files, use custom Typst highlighting
  if (extension === "typ") {
    if (typeof window !== "undefined") {
      const { typstDark, typstLight } = await import(
        "$lib/codemirror/typstHighlight"
      );
      return currentTheme === "light" ? typstLight : typstDark;
    }
  }

  // For BibTeX files, use custom BibTeX highlighting
  if (extension === "bib") {
    if (typeof window !== "undefined") {
      const { bibtexDark, bibtexLight } = await import(
        "$lib/codemirror/bibtexHighlight"
      );
      return currentTheme === "light" ? bibtexLight : bibtexDark;
    }
  }

  // For other files, use default theme syntax highlighting
  return currentTheme === "light" ? greyLightSyntax : greyDarkSyntax;
}

async function getLanguageExtensions() {
  const fileName = get(selectedFile)?.name || "";
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "typ") {
    if (typeof window !== "undefined") {
      const { typst } = await import("codemirror-lang-typst");
      // `codemirror-lang-typst` does declare `commentTokens`, but only with a
      // block token and — because it builds its `Language` with the base
      // constructor instead of `LRLanguage.define()` — it never attaches that
      // facet to its top node, so `state.languageDataAt("commentTokens")` comes
      // back empty and *both* comment commands are no-ops in a `.typ` file.
      // A language-data provider bypasses the syntax-tree lookup entirely; it
      // is scoped to this compartment, which is reconfigured per file, so it
      // only ever answers for Typst documents.
      return [
        EditorState.languageData.of(() => [
          { commentTokens: { line: "//", block: { open: "/*", close: "*/" } } },
        ]),
        typst(),
      ];
    }
  }

  if (extension === "bib") {
    if (typeof window !== "undefined") {
      const { bibtex } = await import("codemirror-lang-bib");
      return [
        bibtex({
          enableLinting: false,
          enableTooltips: true,
          enableAutocomplete: true,
          autoCloseBrackets: false,
        }),
      ];
    }
  }

  return [];
}

function getEditorStyleExtensions() {
  const fontSize = get(editorSettings).fontSize;
  const fontFamily = get(editorSettings).fontFamily;
  return EditorView.theme({
    "&": {
      fontSize: `${fontSize}px`,
      fontFamily: fontFamily,
    },
    ".cm-content": {
      fontSize: `${fontSize}px`,
      fontFamily: fontFamily,
    },
    ".cm-gutters": {
      fontSize: `${fontSize}px`,
    },
  });
}

function getLigaturesExtension() {
  const ligatures = get(editorSettings).ligatures;
  return EditorView.theme({
    "&": {
      fontVariantLigatures: ligatures ? "normal" : "none",
    },
    ".cm-content": {
      fontVariantLigatures: ligatures ? "normal" : "none",
    },
  });
}

// `commentsExtension()` carries its own click handler, but it dispatches through
// the `CommentRangeTracker` singleton — part of the old Yjs-map comment storage,
// which this tree does not use — so it can never fire. Same behaviour, wired
// straight to the context: a plain click (no selection) inside a highlight opens
// its thread.
function createCommentClickHandler() {
  return EditorView.domEventHandlers({
    mouseup(event, viewValue) {
      const selection = viewValue.state.selection.main;
      if (selection.from !== selection.to) return false;

      const target = event.target as HTMLElement;
      const commentId = target
        .closest(".cm-comment-highlight")
        ?.getAttribute("data-comment-id");
      if (!commentId) return false;

      const comment = get(comments).find((c) => c.id === commentId);
      if (comment) selectComment(comment);
      return false;
    },
  });
}

function createErrorIconPlugin() {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        this.applyClasses(view);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet
        ) {
          this.applyClasses(update.view);
        }
      }

      applyClasses(view: EditorView) {
        setTimeout(() => {
          const gutterElements = view.dom.querySelectorAll(
            ".cm-lineNumbers .cm-gutterElement",
          );
          gutterElements.forEach((el) => {
            const text = el.textContent?.trim();
            if (text === "×") {
              (el as HTMLElement).classList.add("cm-error-icon");
            } else {
              (el as HTMLElement).classList.remove("cm-error-icon");
            }
          });
        }, 0);
      }
    },
  );
}


export const projectId = writable<string>("");
export const project = writable<Project | null>(null);
export const leftPanelTab = writable<LeftPanelTab>("files");
export const files = writable<File[]>([]);
export const assets = writable<Asset[]>([]);
export const comments = writable<Comment[]>([]);
export const selectedFile = writable<File | null>(null);
export const mainFile = writable<File | null>(null);
export const selectedAsset = writable<Asset | null>(null);
export const editorElement = writable<HTMLDivElement | undefined>();
export const projectYjs = writable<YjsConnection | null>(null);
export const ydoc = derived(
  projectYjs,
  ($projectYjs) => $projectYjs?.ydoc || null,
);
export const awarenessStates = writable<[number, Record<string, any>][]>([]);
let stopAwarenessListener: (() => void) | null = null;
projectYjs.subscribe((yjsConnection) => {
  stopAwarenessListener?.();
  stopAwarenessListener = null;

  const awareness = yjsConnection?.provider.awareness;
  if (!awareness) {
    awarenessStates.set([]);
    return;
  }

  const updateAwarenessStates = () => {
    awarenessStates.set(Array.from(awareness.getStates().entries()));
  };
  awareness.on("change", updateAwarenessStates);
  updateAwarenessStates();
  stopAwarenessListener = () => awareness.off("change", updateAwarenessStates);
});
export const editorNewCommentDraft = writable<{
  text: string;
  range: { from: number; to: number };
  selectedText: string;
} | null>(null);
export const projectSync = writable<ReturnType<typeof createProjectSync> | null>(null);
export const commentSync = writable<ReturnType<typeof createCommentSync> | null>(null);
export const activeCommentId = writable<string | null>(null);
export const view = writable<EditorView | null>(null);
let undoManager: Y.UndoManager | null = null;

// A `Y.UndoManager` registers observers on the type it tracks and on the
// document itself; dropping the reference is not enough, so the one built for
// the previous file has to be destroyed before it is replaced — otherwise every
// file switch leaks a manager still listening on the file we left.
function setUndoManager(next: Y.UndoManager | null) {
  undoManager?.destroy();
  undoManager = next;
}

export const ytext = derived([ydoc, selectedFile], ([$ydoc, $selectedFile]) => {
  const ytextValue = $ydoc?.getText(`file-${$selectedFile?.id}`);
  setUndoManager(ytextValue ? new Y.UndoManager(ytextValue) : null);
  return ytextValue;
});
export const previewIframe = writable<HTMLIFrameElement | undefined>();
export const currentUserRole = writable<"owner" | "admin" | "writer" | "commentor" | "reader">("reader");

export function toggleWrap(prefix: string, suffix: string) {
  if (!get(canWrite)) return;
  const viewValue = get(view);
  if (!viewValue) return;

  const { from, to } = viewValue.state.selection.main;
  const selectedText = viewValue.state.doc.sliceString(from, to);

  // Check if we have text before and after selection
  const beforeStart = Math.max(0, from - prefix.length);
  const afterEnd = Math.min(viewValue.state.doc.length, to + suffix.length);
  const textBefore = viewValue.state.doc.sliceString(beforeStart, from);
  const textAfter = viewValue.state.doc.sliceString(to, afterEnd);

  // Check if already wrapped
  const isWrapped =
    textBefore.endsWith(prefix) && textAfter.startsWith(suffix);

  if (isWrapped) {
    // Remove wrapping
    if (selectedText) {
      // Selection exists - remove prefix before and suffix after
      // Changes array positions are relative to original document, CodeMirror handles adjustments
      viewValue.dispatch({
        changes: [
          { from: from - prefix.length, to: from, insert: "" },
          { from: to, to: to + suffix.length, insert: "" },
        ],
        selection: { anchor: from - prefix.length, head: to - prefix.length },
      });
    } else {
      // No selection, just cursor - remove prefix before and suffix after
      viewValue.dispatch({
        changes: [
          { from: from - prefix.length, to: from, insert: "" },
          { from: from, to: from + suffix.length, insert: "" },
        ],
        selection: { anchor: from - prefix.length },
      });
    }
  } else {
    // Add wrapping
    if (selectedText) {
      // Wrap selection
      viewValue.dispatch({
        changes: { from, to, insert: `${prefix}${selectedText}${suffix}` },
        selection: {
          anchor: from + prefix.length,
          head: from + prefix.length + selectedText.length,
        },
      });
    } else {
      // Insert prefix and suffix at cursor
      viewValue.dispatch({
        changes: { from, insert: `${prefix}${suffix}` },
        selection: { anchor: from + prefix.length },
      });
    }
  }
  viewValue.focus();
}

// Undo/redo go through the Yjs `UndoManager`, not CodeMirror's history: the
// document is a shared type, so CodeMirror's own history would undo other
// people's edits. `undoManager` is rebuilt by the `ytext` derived store on every
// file switch, so read it at call time and never hold on to it.
export function undo() {
  if (!get(canWrite)) return false;
  if (!undoManager?.canUndo()) return false;
  undoManager.undo();
  get(view)?.focus();
  return true;
}

export function redo() {
  if (!get(canWrite)) return false;
  if (!undoManager?.canRedo()) return false;
  undoManager.redo();
  get(view)?.focus();
  return true;
}

export function canUndo() {
  return get(canWrite) && !!undoManager?.canUndo();
}

export function canRedo() {
  return get(canWrite) && !!undoManager?.canRedo();
}

export function selectAll() {
  const viewValue = get(view);
  if (!viewValue) return false;
  const result = selectAllCommand(viewValue);
  viewValue.focus();
  return result;
}

export function toggleLineComment() {
  if (!get(canWrite)) return false;
  const viewValue = get(view);
  if (!viewValue) return false;
  const result = toggleLineCommentCommand(viewValue);
  viewValue.focus();
  return result;
}

export function toggleBlockComment() {
  if (!get(canWrite)) return false;
  const viewValue = get(view);
  if (!viewValue) return false;
  const result = toggleBlockCommentCommand(viewValue);
  viewValue.focus();
  return result;
}

// Line-structure counterpart of `toggleWrap`, for the list buttons: adds
// `prefix` to every line the selection touches, or strips it from all of them
// when they all already carry it. The prefix goes after the indentation so that
// nested list items keep their level.
export function toggleLinePrefix(prefix: string) {
  if (!get(canWrite)) return;
  const viewValue = get(view);
  if (!viewValue) return;

  const { state } = viewValue;
  const { from, to } = state.selection.main;
  const firstLineNumber = state.doc.lineAt(from).number;
  const lastLineNumber = state.doc.lineAt(to).number;

  const lines = [];
  for (let n = firstLineNumber; n <= lastLineNumber; n++) {
    lines.push(state.doc.line(n));
  }

  const indentLength = (text: string) => text.length - text.trimStart().length;
  const hasPrefix = (text: string) => text.slice(indentLength(text)).startsWith(prefix);

  // Blank lines are ignored on a multi-line selection: they are separators, not
  // list items. A single blank line (just a cursor) still gets the prefix.
  const targets = lines.length > 1
    ? lines.filter((line) => line.text.trim() !== "")
    : lines;
  if (targets.length === 0) return;

  const allPrefixed = targets.every((line) => hasPrefix(line.text));

  const changes = allPrefixed
    ? targets.map((line) => {
      const at = line.from + indentLength(line.text);
      return { from: at, to: at + prefix.length, insert: "" };
    })
    : targets
      .filter((line) => !hasPrefix(line.text))
      .map((line) => {
        const at = line.from + indentLength(line.text);
        return { from: at, to: at, insert: prefix };
      });

  if (changes.length === 0) return;

  viewValue.dispatch({ changes });
  viewValue.focus();
}

export function toggleLineWrapping() {
  wrapLines.update((enabled) => !enabled);
}

function createUndoRedoKeymap() {
  if (!undoManager) {
    return keymap.of([]);
  }

  return keymap.of([
    { key: "Mod-z", run: () => undo() },
    { key: "Mod-Shift-z", run: () => redo() },
    { key: "Mod-y", run: () => redo() },
    {
      key: "Mod-b",
      run: () => {
        toggleWrap("*", "*");
        return true;
      },
    },
    {
      key: "Mod-i",
      run: () => {
        toggleWrap("_", "_");
        return true;
      },
    },
    {
      key: "Mod-u",
      run: () => {
        toggleWrap("#underline[", "]");
        return true;
      },
    },
    {
      key: "Tab",
      run: (view) => {
        return indentMore(view);
      },
    },
    {
      key: "Shift-Tab",
      run: (view) => {
        return indentLess(view);
      },
    },
  ]);
}


async function createExtensions() {
  const ytextValue = get(ytext);
  const provider = get(projectYjs)?.provider;
  // Read into a const: `undoManager` is reassigned on every file switch, and
  // the extension list must be built against the one that existed when it ran.
  const undoManagerValue = undoManager;
  const collabReady = ytextValue && provider && undoManagerValue;
  const extensions = [
    foldGutter(),
    lineWrappingCompartment.of(getLineWrappingExtensions()),
    lineNumbersCompartment.of(getLineNumbersExtension()),
    basicSetup,
    // search({ createPanel: createFindPanel }),
    themeCompartment.of(getThemeExtensions()),
    syntaxCompartment.of(await getSyntaxHighlighting()),
    languageCompartment.of(await getLanguageExtensions()),
    editorStyleCompartment.of(getEditorStyleExtensions()),
    ligaturesCompartment.of(getLigaturesExtension()),
    createErrorIconPlugin(),
    bracketMatching(),
    closeBrackets(),
    indentOnInput(),
    indentUnit.of("  "), // Set indentation to 2 spaces
    readOnlyCompartment.of(EditorState.readOnly.of(!get(canWrite))),
    editableCompartment.of(EditorView.editable.of(get(canWrite))),
    ...(collabReady ? [yCollab(ytextValue, provider.awareness, { undoManager: undoManagerValue })] : []),
    createUndoRedoKeymap(),
    commentsExtension(),
    createCommentClickHandler(),
    highlightCompartement.of(getHighlightExtensions()),
  ];
  return extensions;
}


// `createExtensions()` only *seeds* the compartments — nothing ever called
// `reconfigure()`, so a theme, font or file-type change did not reach a view that
// was already built, and only took effect at the next full rebuild. Each
// subscription below bails out when there is no view yet (the next
// `createExtensions()` reads the new value anyway) and re-checks the view after
// every `await`, so a rebuild that happens mid-flight is not clobbered.

async function reconfigureSyntaxHighlighting(viewValue: EditorView) {
  const syntax = await getSyntaxHighlighting();
  if (get(view) !== viewValue) return;
  viewValue.dispatch({ effects: syntaxCompartment.reconfigure(syntax) });
}

async function reconfigureLanguage(viewValue: EditorView) {
  const language = await getLanguageExtensions();
  if (get(view) !== viewValue) return;
  viewValue.dispatch({ effects: languageCompartment.reconfigure(language) });
}

theme.subscribe(() => {
  const viewValue = get(view);
  if (!viewValue) return;
  viewValue.dispatch({
    effects: themeCompartment.reconfigure(getThemeExtensions()),
  });
  void reconfigureSyntaxHighlighting(viewValue);
});

editorSettings.subscribe(() => {
  const viewValue = get(view);
  if (!viewValue) return;
  viewValue.dispatch({
    effects: [
      editorStyleCompartment.reconfigure(getEditorStyleExtensions()),
      ligaturesCompartment.reconfigure(getLigaturesExtension()),
    ],
  });
});

wrapLines.subscribe((enabled) => {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(WRAP_LINES_STORAGE_KEY, String(enabled));
    } catch {
      // Storage can be unavailable (private mode, quota); the preference is
      // then simply not remembered across reloads.
    }
  }
  const viewValue = get(view);
  if (!viewValue) return;
  viewValue.dispatch({
    effects: lineWrappingCompartment.reconfigure(getLineWrappingExtensions()),
  });
});

// The file extension is what picks Typst over BibTeX. `ytext` normally rebuilds
// the whole state just after this, but not when the Yjs document is not up yet.
selectedFile.subscribe(() => {
  const viewValue = get(view);
  if (!viewValue) return;
  void reconfigureLanguage(viewValue);
  void reconfigureSyntaxHighlighting(viewValue);
});


function onFileCreated(file: File) {
  files.update((currentFiles) => {
    if (!currentFiles.find((f) => f.id === file.id)) {
      return [...currentFiles, file];
    }
    return currentFiles;
  });
}

function onFileUpdated(file: File) {
  files.update((currentFiles) => {
    return currentFiles.map((f) => (f.id === file.id ? file : f));
  });
  if (get(selectedFile)?.id === file.id) {
    selectedFile.set(file);
  }
}

function onFileDeleted(fileId: string) {
  files.update((currentFiles) => {
    const updatedFiles = currentFiles.filter((f) => f.id !== fileId);
    if (get(selectedFile)?.id === fileId) {
      selectedFile.set(updatedFiles[0] || null);
    }
    return updatedFiles;
  });

  if (get(projectYjs)?.ydoc) {
    const ytext = get(projectYjs)?.ydoc.getText(`file-${fileId}`);
    if (ytext && ytext.length > 0) {
      ytext.delete(0, ytext.length);
    }
  }
}

function onAssetCreated(asset: Asset) {
  // if (!assets.find((a) => a.id === asset.id)) {
  //   assets = [...assets, asset];
  // }
  assets.update((currentAssets) => {
    if (!currentAssets.find((a) => a.id === asset.id)) {
      return [...currentAssets, asset];
    }
    return currentAssets;
  });
}

function onAssetUpdated(asset: Asset) {
  assets.update((currentAssets) => {
    return currentAssets.map((a) => (a.id === asset.id ? asset : a));
  });
  if (get(selectedAsset)?.id === asset.id) {
    selectedAsset.set(asset);
  }
}

function onAssetDeleted(assetId: string) {
  // Remove from cache
  removeCachedAsset(get(projectId), assetId).catch((err) =>
    console.warn("Failed to remove deleted asset from cache:", err),
  );
  assets.update((currentAssets) => currentAssets.filter((a) => a.id !== assetId));
  if (get(selectedAsset)?.id === assetId) {
    selectedAsset.set(null);
  }
}

function onProjectUpdated(updatedProject: Project) {
  project.update((currentProject) => {
    if (currentProject && updatedProject.id === currentProject.id) {
      return { ...currentProject, ...updatedProject };
    }
    return currentProject;
  });
}

function destroyYjsConnection(connection: YjsConnection) {
  connection.provider.destroy()
  connection.indexeddb.destroy()
  connection.ydoc.destroy()
}

function applyReplyUpdate(threadId: string, reply: CommentReplyDTO) {
  if (reply.status === "deleted") {
    return;
  }

  comments.update((editorComments) => {
    editorComments = editorComments.map((comment) => {
      if (comment.id !== threadId) {
        return comment;
      }

      const nextReplies = comment.replies.some((item) => item.id === reply.id)
        ? comment.replies.map((item) =>
          item.id === reply.id
            ? {
              id: reply.id,
              content: reply.content,
              authorId: reply.author_id,
              createdAt: reply.created_at,
            }
            : item,
        )
        : [
          ...comment.replies,
          {
            id: reply.id,
            content: reply.content,
            authorId: reply.author_id,
            createdAt: reply.created_at,
          },
        ];

      return {
        ...comment,
        replies: nextReplies,
        updatedAt: reply.updated_at,
      };
    });
    return editorComments;
  });
}

function destroyRealtimeConnections() {
  projectYjs.update((yjsConnection) => {
    if (yjsConnection) {
      destroyYjsConnection(yjsConnection);
      yjsConnection = null;
    }
    return yjsConnection;
  });
  projectSync.update((projectSync) => {
    if (projectSync) {
      projectSync.destroy();
      projectSync = null;
    }
    return projectSync;
  });
  commentSync.update((commentSync) => {
    if (commentSync) {
      commentSync.destroy();
      commentSync = null;
    }
    return commentSync;
  });
}

function initRealtimeConnections() {
  projectYjs.set(createProjectYjs(
    get(projectId),
    get(auth).user,
    get(auth).token,
  ));

  projectSync.set(createProjectSync(get(projectId), {
    onFileCreated,
    onFileUpdated,
    onFileDeleted,
    onAssetCreated,
    onAssetUpdated,
    onAssetDeleted,
    onProjectUpdated,
    onUnauthorized: (event) => {
      void handlePermissionSignal(
        event.reason || "You no longer have permission for this realtime action",
      );
    },
  }, get(auth).token));

  commentSync.set(createCommentSync(
    get(projectId),
    {
      onConnected: ({ reconnected }) => {
        if (reconnected) {
          void loadCommentsForSelectedFile();
        }
      },
      onThreadCreated: (message) => {
        if (message.thread) {
          applyThreadUpdate(message.thread);
        }
      },
      onThreadUpdated: (message) => {
        if (message.thread) {
          applyThreadUpdate(message.thread);
        }
      },
      onReplyCreated: (message) => {
        if (message.reply && message.thread_id) {
          applyReplyUpdate(message.thread_id, message.reply);
        }
      },
      onPermissionChanged: (message) => {
        void handlePermissionSignal({
          reason: message.reason || "Your project permissions have changed",
          action: message.action,
          newRole: message.new_role,
        });
      },
      onUnauthorized: (event) => {
        void handlePermissionSignal(
          event.reason ||
          "You no longer have permission for realtime comment updates",
        );
      },
    },
    get(auth).token,
  ));
}

let isRefreshingPermissions = false;
let isResettingRealtime = false;

async function resetRealtimeConnectionsForWriteLoss() {
  if (isResettingRealtime) return;
  isResettingRealtime = true;

  try {
    const selectedFileId = get(selectedFile)?.id ?? null;

    // Drop old Yjs doc/provider state so unsynced edits cannot be replayed later.
    destroyRealtimeConnections();
    initRealtimeConnections();

    // Force file reselection so the rebuilt editor instance reopens the current file.
    if (selectedFileId) {
      const reopenedFile = get(files).find((file) => file.id === selectedFileId) || null;
      selectedFile.set(null);
      await tick();
      selectedFile.set(reopenedFile);
    }

    await loadCommentsForSelectedFile();
  } finally {
    isResettingRealtime = false;
  }
}

async function loadProject(): Promise<boolean> {
  try {
    project.set(await projectsApi.get(get(projectId)));
    currentUserRole.set((get(project)?.current_user_role || "reader"));
    return true;
  } catch (error) {
    console.error("Failed to load project:", error);
    const status = (error as any)?.response?.status;
    if (status === 404 || status === 403) {
      notifications.show("Project not found", "error", 5000);
      if (get(auth).user?.user_type === "guest") {
        goto("/login", { replaceState: true });
      } else {
        goto("/");
      }
    }
    return false;
  }
}

async function handlePermissionSignal(
  signal:
    | string
    | {
      reason: string;
      action?: "role_updated" | "removed_from_project";
      newRole?: "owner" | "admin" | "writer" | "commentor" | "reader";
    },
) {
  if (isRefreshingPermissions) return;
  isRefreshingPermissions = true;

  const normalized = typeof signal === "string" ? { reason: signal } : signal;
  const reason = normalized.reason;
  const action = normalized.action;
  const newRole = normalized.newRole;

  const hadWrite = ["owner", "admin", "writer"].includes(get(currentUserRole));
  const hadComment = ["owner", "admin", "writer", "commentor"].includes(get(currentUserRole));

  try {
    const nextCanWriteFromRole = (role: string) => ["owner", "admin", "writer"].includes(role);
    const nextCanCommentFromRole = (role: string) => nextCanWriteFromRole(role) || role === "commentor";

    const hasImmediateRoleUpdate = action === "removed_from_project" || !!newRole;

    if (project && action === "removed_from_project") {
      project.update((p) => p ? { ...p, current_user_role: "reader" } : p);
      currentUserRole.set("reader");
    } else if (project && newRole) {
      project.update((p) => p ? { ...p, current_user_role: newRole } : p);
      currentUserRole.set(newRole);
    } else if (!project && newRole) {
      currentUserRole.set(newRole);
    }

    if (!hasImmediateRoleUpdate) {
      const loaded = await loadProject();
      if (!loaded) return;
    } else {
      // Reconcile with backend source of truth without delaying UI lock.
      void loadProject();
    }

    const resolvedRole = get(currentUserRole);
    const nextCanWrite = nextCanWriteFromRole(resolvedRole);
    const nextCanComment = nextCanCommentFromRole(resolvedRole);

    if (hadWrite && !nextCanWrite) {
      editorNewCommentDraft.set(null);
      await resetRealtimeConnectionsForWriteLoss();
      notifications.show(
        reason || "Your write access was removed. Editor switched to read-only.",
        "warning",
        5000,
      );
      return;
    }

    if (hadComment && !nextCanComment) {
      editorNewCommentDraft.set(null);
      notifications.show(
        reason || "Your comment access was removed. Comment inputs are disabled.",
        "warning",
        5000,
      );
      return;
    }

    notifications.show(reason || "Project permissions were updated.", "info", 3000);
  } finally {
    isRefreshingPermissions = false;
  }
}

function mapThreadToComment(thread: CommentThreadDTO): Comment {
  return {
    id: thread.id,
    fileId: thread.file_id,
    content: thread.content,
    authorId: thread.author_id,
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
    resolved: thread.status === "resolved",
    replies: (thread.replies || [])
      .filter((reply) => reply.status !== "deleted")
      .map((reply) => ({
        id: reply.id,
        content: reply.content,
        authorId: reply.author_id,
        createdAt: reply.created_at,
      })),
    line: 1,
    anchorRelJson: thread.anchor_rel_json,
    headRelJson: thread.head_rel_json,
  };
}

export function commentorColor(userId: string) {
  const safeUserId = String(userId ?? "");
  const seed = safeUserId
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = (seed * 47) % 360;
  return `hsl(${hue} 55% 45%)`;
}

export function isCommentorGuest(userId: string) {
  const profile = get(commentors).find((c) => c.id === userId);
  if (!profile) return false;
  return profile.user_type === "guest";
}

export function commentorName(userId: string) {
  const profile = get(commentors).find((c) => c.id === userId);
  return profile?.display_name || `User ${userId}`;
}

export let commentors: Writable<UserProfile[]> = writable([]);

async function loadCommentsForSelectedFile() {
  const file = get(selectedFile);
  if (!file || file.is_folder || get(selectedAsset)) {
    comments.set([]);
    return;
  }

  try {
    const threads = await commentsApi.listFileThreads(get(projectId), file.id);
    if (get(selectedFile)?.id !== file.id) {
      return;
    }

    const newComments = threads
      .filter((thread) => thread.status !== "deleted")
      .map(mapThreadToComment)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    commentors.set([]);
    newComments.forEach(async (comment) => {
      const profile = await usersApi.getProfile(comment.authorId);
      commentors.update((currentCommentors) => {
        if (!currentCommentors.find((c) => c.id === profile.id)) {
          return [...currentCommentors, profile];
        }
        return currentCommentors;
      });
      comment.replies.forEach(async (reply) => {
        const replyProfile = await usersApi.getProfile(reply.authorId);
        commentors.update((currentCommentors) => {
          if (!currentCommentors.find((c) => c.id === replyProfile.id)) {
            return [...currentCommentors, replyProfile];
          }
          return currentCommentors;
        });
      });
    });

    comments.set(newComments);
  } catch (error: any) {
    console.error("Failed to load comments:", error);
    const message = error?.response?.data?.detail || "Failed to load comments";
    notifications.show(message, "error", 4000);
  }
}

function applyThreadUpdate(thread: CommentThreadDTO) {
  if (thread.status === "deleted") {
    comments.update((editorComments) => editorComments.filter((comment) => comment.id !== thread.id));
    activeCommentId.update((activeCommentId) => {
      if (activeCommentId === thread.id) {
        return null;
      }
      return activeCommentId;
    });
    return;
  }

  if (get(selectedFile)?.id !== thread.file_id) {
    return;
  }

  const mapped = mapThreadToComment(thread);
  const index = get(comments).findIndex((comment) => comment.id === mapped.id);
  if (index === -1) {
    comments.update((editorComments) => [...editorComments, mapped].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    return;
  }

  comments.update((editorComments) => editorComments.map((comment) =>
    comment.id === mapped.id ? mapped : comment,
  ));
}

// Bumped by initContext (new session starting) and destroyContext (session
// torn down), so an in-flight initContext or editorElement.subscribe callback
// can tell its work has been superseded and stop before touching stores or
// opening connections for an abandoned project.
let contextGeneration = 0;

// Set when `initContext` gives up, so the route can show why instead of an
// editor with no project behind it. Cleared at the start of every init.
export const initError = writable<string | null>(null);

export async function initContext(projectIdValue: string) {
  const generation = ++contextGeneration;

  initError.set(null);
  files.set([]);
  assets.set([]);
  comments.set([]);
  commentors.set([]);
  diagnostics.set([]);
  selectedFile.set(null);
  selectedAsset.set(null);
  mainFile.set(null);
  searchText.set("");
  searchMatches.set([]);
  activeCommentId.set(null);
  commentDraft.set(null);

  projectId.set(projectIdValue);

  // Every request below can reject, and the route only leaves its "Loading…"
  // screen once this resolves — an unhandled rejection here used to hang the
  // editor forever with nothing but a console message. A failure stops the
  // sequence (there is no point opening sockets for a project we could not
  // read) and is reported through `initError` for the route to render.
  try {
    const loaded = await loadProject();
    if (generation !== contextGeneration) return;
    if (!loaded) {
      // `loadProject()` has already shown its own notification, and navigates
      // away on 404/403.
      initError.set("This project could not be opened.");
      return;
    }
    initRealtimeConnections();
    const newFiles = await filesApi.list(projectIdValue);
    if (generation !== contextGeneration) return;
    files.update(() => newFiles);
    const newAssets = await assetsApi.list(projectIdValue);
    if (generation !== contextGeneration) return;
    assets.set(newAssets);
    await initSelectedFile();
    if (generation !== contextGeneration) return;
    initWorker();
  } catch (error) {
    if (generation !== contextGeneration) return;
    console.error("Failed to open the project:", error);
    const detail = errorDetail(error, "This project could not be opened.");
    initError.set(detail);
    notifications.show(detail, "error", 5000);
  }
}

let disposeSelectionListener: (() => void) | null = null;

function setupSelectionListener() {
  if (disposeSelectionListener) {
    disposeSelectionListener();
    disposeSelectionListener = null;
  }

  const viewValue = get(view);
  if (!viewValue) return;
  const editorDom = viewValue.dom;

  const handleSelectionChange = () => {
    setTimeout(() => {
      const selection = getSelection();
      if (
        selection &&
        selection.from !== selection.to &&
        selection.text.trim()
      ) {
        // Get the coordinates of the selection
        const coords = viewValue.coordsAtPos(selection.to);
        if (coords) {
          const containerRect = viewValue.dom.getBoundingClientRect();
          showCommentButton.set(true);
          commentButtonPosition.set({
            top: coords.top - containerRect.top + 20,
            left: coords.left - containerRect.left,
          });
        }
      } else {
        showCommentButton.set(false);
      }
    }, 10);
  };

  editorDom.addEventListener("mouseup", handleSelectionChange);
  editorDom.addEventListener("mousedown", handleSelectionChange);
  editorDom.addEventListener("keyup", handleSelectionChange);
  editorDom.addEventListener("keydown", handleSelectionChange);

  disposeSelectionListener = () => {
    editorDom.removeEventListener("mouseup", handleSelectionChange);
    editorDom.removeEventListener("mousedown", handleSelectionChange);
    editorDom.removeEventListener("keyup", handleSelectionChange);
    editorDom.removeEventListener("keydown", handleSelectionChange);
  };
}

view.subscribe(() => {
  setupSelectionListener();
});

// The compiler entry point. `compile()` used to fall back to the literal
// "/main.typ", so a project whose entry point is named anything else never
// compiled. The choice is remembered per project, because it is a property of
// how the author works on that document, not of this browser session.
const MAIN_FILE_STORAGE_PREFIX = "collabst:main-file:";

function readStoredMainFileId(projectIdValue: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(`${MAIN_FILE_STORAGE_PREFIX}${projectIdValue}`);
  } catch {
    return null;
  }
}

function writeStoredMainFileId(projectIdValue: string, fileId: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`${MAIN_FILE_STORAGE_PREFIX}${projectIdValue}`, fileId);
  } catch {
    // Storage can be unavailable (private mode, quota); the choice is then
    // simply not remembered across reloads.
  }
}

function resolveMainFile(): File | null {
  const candidates = get(files).filter((f) => !f.is_folder);

  const rememberedId = readStoredMainFileId(get(projectId));
  const remembered = rememberedId
    ? candidates.find((f) => f.id === rememberedId)
    : undefined;
  if (remembered) return remembered;

  return (
    candidates.find((f) => f.path === "/main.typ") ??
    candidates.find((f) => f.name.toLowerCase().endsWith(".typ")) ??
    null
  );
}

export function setMainFile(fileId: string) {
  const file = get(files).find((f) => f.id === fileId);
  if (!file || file.is_folder) return;

  mainFile.set(file);
  writeStoredMainFileId(get(projectId), file.id);
  syncFilesAndAssets();
}

export async function initSelectedFile() {
  const allFiles = get(files);

  const entryFile = resolveMainFile();
  mainFile.set(entryFile);

  if (entryFile) {
    selectFile(entryFile.id);
    return;
  }

  if (allFiles.length > 0) {
    selectFile(allFiles[0].id);
  }
}

// The entry point can move under us — a collaborator renames or deletes it, and
// the projectSync WS pushes the new list. `mainFile` held the row it was given
// at init, so `compile()` kept posting a path the worker no longer has until the
// next reload. The stored id is left untouched on the delete path: falling back
// to another file is a guess, not a choice the author made, so it should not
// overwrite one they did make.
files.subscribe(($files) => {
  const current = get(mainFile);
  if (!current) return;

  const updated = $files.find((f) => f.id === current.id && !f.is_folder);
  if (updated) {
    if (updated === current) return;
    // Same row, new object: a rename or a move changed its path, and the
    // compiler has to be told which document to build.
    mainFile.set(updated);
    if (updated.path !== current.path) syncFilesAndAssets();
    return;
  }

  const replacement = resolveMainFile();
  mainFile.set(replacement);
  // No replacement means the project has no `.typ` file left (or is being torn
  // down); there is nothing to compile, and `compile()` keeps its own fallback.
  if (replacement) syncFilesAndAssets();
});

editorElement.subscribe(async (el) => {
  if (!el) return;
  const generation = contextGeneration;
  const extensions = await createExtensions();
  if (generation !== contextGeneration) return;
  const ytextValue = get(ytext);
  view.update((v) => {
    if (v) {
      v.destroy();
    }
    return new EditorView({
      doc: ytextValue?.toString() ?? "",
      parent: el,
      extensions,
    });
  });
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
  void loadCommentsForSelectedFile();
}

async function updateEditorContent() {
  const viewValue = get(view);
  const ytextValue = get(ytext);
  if (!viewValue || !ytextValue) return;

  const extensions = await createExtensions();
  viewValue.setState(
    CMState.create({
      doc: ytextValue.toString(),
      extensions,
    }),
  );
  // `setState` recreates `commentField`, which starts at `Decoration.none`, so
  // the comment highlights have to be re-applied to the rebuilt state.
  syncCommentDecorations();
}

ytext.subscribe(async (newYText) => {
  updateEditorContent();
});


let compileEnabled = true;
let separateWindow: Window | null = null;

function updateLinter() {
  const editorView = get(view);
  if (editorView) {
    const lintDiagnostics = convertDiagnosticsToLint(
      get(diagnostics),
      editorView,
      get(selectedFile)?.path || "",
    );
    const transaction = setDiagnostics(editorView.state, lintDiagnostics);
    editorView.dispatch(transaction);
  }
}

function sendVectorDataToWindow(targetWindow: Window, vectorData: ArrayBuffer, isFirstCompile: boolean) {
  targetWindow.postMessage(
    {
      type: 'typst-vector-data',
      data: vectorData,
      isFirstCompile: isFirstCompile,
    },
    '*'
  );
}

export let diagnostics: Writable<Diagnostic[]> = writable([]);

function navigateTo(
  from: number | [number, number],
  to?: number | [number, number],
) {
  const viewValue = get(view);
  if (!viewValue) return;

  const doc = viewValue.state.doc;

  if (from instanceof Array) {
    const [startLine, startChar] = from;

    const startLineNum = Math.max(1, startLine);
    if (startLineNum > doc.lines) return;

    const startLineObj = doc.line(startLineNum);
    from = startLineObj.from + Math.max(0, startChar);
  }

  if (to instanceof Array) {
    const [endLine, endChar] = to;

    const endLineNum = Math.max(1, endLine);
    if (endLineNum > doc.lines) return;

    const endLineObj = doc.line(endLineNum);
    to = endLineObj.from + Math.max(0, endChar);
  }

  viewValue.dispatch({
    selection: { anchor: from, head: to ?? from },
    scrollIntoView: true,
  });
  viewValue.focus();
}

export function gotoDiagnostic(diagnostic: Diagnostic) {
  if (!diagnostic.range) return;

  // Find the file by path
  const diagnosticFile = get(files).find((f) => {
    const filePath = f.path.startsWith("/") ? f.path.slice(1) : f.path;
    const diagnosticPath = diagnostic.path
      ? diagnostic.path.startsWith("/")
        ? diagnostic.path.slice(1)
        : diagnostic.path
      : "";
    return filePath === diagnosticPath || f.name === diagnostic.path;
  });

  if (diagnosticFile) {
    // Select the file
    selectedFile.set(diagnosticFile);
    selectedAsset.set(null);

    // Navigate to the diagnostic in the editor
    setTimeout(() => {
      navigateTo(
        [diagnostic.range!.start.line + 1,
        diagnostic.range!.start.character],
        [diagnostic.range!.end.line + 1,
        diagnostic.range!.end.character]
      );
    }, 100);
  }
}

// `getLineNumbersExtension()`'s `formatNumber` reads `errorLines` at render
// time, so the Set must hold the *open* file's error lines only. `diagnostics`
// covers the whole project, hence the path filter — the same one
// `convertDiagnosticsToLint` uses, so gutter and lint underlines always agree.
// The reconfigure is what forces the gutter to redraw with the new Set.
function updateErrorLines() {
  const currentPath = get(selectedFile)?.path || "";
  errorLines = new Set(
    get(diagnostics)
      .filter((d) => d.severity === "error" && d.range && (!d.path || d.path === currentPath))
      .map((d) => d.range!.start.line + 1),
  );

  const viewValue = get(view);
  if (!viewValue) return;
  viewValue.dispatch({
    effects: lineNumbersCompartment.reconfigure(getLineNumbersExtension()),
  });
}

// Diagnostics outlive a file switch, so the gutter of the newly opened file has
// to be recomputed even though no new compile has happened.
selectedFile.subscribe(() => {
  updateErrorLines();
});

function onDiagnostics(diags: any[] = []) {
  // Parse diagnostics range from compiler format
  diagnostics.set(
    diags.map((d: any) => ({
      severity: d.severity,
      message: d.message,
      range: parseRange(d.range),
      path: d.path,
    }))
  );
  updateErrorLines();
  updateLinter();
}

let worker: Worker;
let workerInitialized = false;

function sendVectorDataToIframe(vectorData: ArrayBuffer, isFirstCompile: boolean) {
  const previewIframeValue = get(previewIframe);
  if (!previewIframeValue?.contentWindow || !iframeMockReady) {
    return;
  }

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
  previewIframeValue.contentWindow.postMessage({
    type: 'typst-ws-message',
    data: combined.buffer.slice(0)
  }, '*');
}

// The compiler's human-readable line ("Ready (123 ms)", "Compile error: …") and
// the coarse lifecycle state the preview toolbar renders. Both used to be plain
// module variables — and `status` was not even declared, so every assignment
// silently wrote `window.status` and no UI could ever read it.
export const compileStatus = writable<string>("");
export const previewStatus = writable<"idle" | "compiling" | "ready" | "error">("idle");

export function initWorker() {
  if (!workerInitialized) {
    workerInitialized = true;
    worker = new Worker(
      new URL('/src/lib/preview/typst-worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = async (e) => {
      const { type, vectorData, compileTime, isFirstCompile, diagnostics } = e.data;
      // Only compile results carry diagnostics. `status`, `pdf` and `reset`
      // messages do not, and passing their `undefined` through defaulted to an
      // empty list — which wiped the issues panel right after a failed compile.
      if (Array.isArray(diagnostics)) onDiagnostics(diagnostics);

      switch (type) {
        case 'status':
          compileStatus.set(e.data.message);
          break;

        case 'initialized':
          workerReady = true;
          compileStatus.set(compileEnabled
            ? 'Compiler ready - waiting for iframe...'
            : 'Preparing files...');

          // Force a sync only when file hydration is ready.
          if (compileEnabled) {
            syncFilesAndAssets();
          }
          reapplyCurrentZoomMode();
          break;

        case 'compiled':
          // Mirrors the worker, which only flips its own `hasCompiled` when it
          // actually emitted an artifact.
          if (vectorData) workerHasCompiled = true;
          if (!initialized) {
            compileStatus.set('Waiting for iframe...');
            return;
          }

          if (!vectorData) {
            compileStatus.set(`Ready (${compileTime}ms) - no output`);
            previewStatus.set('ready');
            return;
          }

          try {
            compileStatus.set('Rendering...');

            if (separateWindow) {
              sendVectorDataToWindow(separateWindow, vectorData, isFirstCompile);
            } else {
              // Send vector data to iframe
              sendVectorDataToIframe(vectorData, isFirstCompile);
            }

            compileStatus.set(`Ready (${compileTime}ms)`);
            previewStatus.set('ready');
          } catch (error: any) {
            compileStatus.set(`Render error: ${error.message}`);
            previewStatus.set('error');
            console.error('Render error:', error);
          }
          break;

        case 'error':
          compileStatus.set(`Compile error: ${e.data.error}`);
          previewStatus.set('error');
          console.error('Compilation error:', e.data);
          break;

        case 'pdf':
          downloadBlob(
            new Blob([e.data.pdfData], { type: 'application/pdf' }),
            `${get(project)?.name || 'document'}.pdf`,
          );
          break;

        case 'reset':
          console.log('Worker: Resetting document as requested');
          // if (typstDoc) typstDoc.reset();
          compileStatus.set('Reset complete');
          break;
      }
    };

    worker.onerror = (e) => {
      const errorMsg = e.message || (e.error as any)?.message || 'Unknown error';
      compileStatus.set(`Worker error: ${errorMsg}`);
      previewStatus.set('error');
      console.error('Worker error:', e);
    };
  }
}

// --- Exports -----------------------------------------------------------------

export function exportPdf() {
  if (!worker || !workerReady) {
    notifications.show("The compiler is not ready yet", "warning", 3000);
    return;
  }
  const mainFilePath = get(mainFile)?.path || '/main.typ';
  const path = mainFilePath.startsWith('/') ? mainFilePath : `/${mainFilePath}`;
  worker.postMessage({ type: 'exportPDF', payload: { mainFilePath: path } });
}

// File contents come from the Yjs document, never from `file.content`: the REST
// row carries whatever was last persisted, which lags behind what the user (and
// everyone else) has typed.
export async function exportSourcesAsZip() {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  const ydocValue = get(projectYjs)?.ydoc ?? null;

  for (const file of get(files)) {
    if (file.is_folder) continue;
    const path = file.path.startsWith('/') ? file.path.slice(1) : file.path;
    zip.file(path, getFileText(ydocValue, file.id)?.toString() ?? "");
  }

  for (const asset of get(assets)) {
    try {
      let arrayBuffer: ArrayBuffer;
      const cached = await getCachedAsset(String(asset.project_id), asset.id, asset.storage_path);
      if (cached) {
        arrayBuffer = cached.blob;
      } else {
        const { url } = await assetsApi.getUrl(String(asset.project_id), asset.id);
        const response = await fetch(url);
        arrayBuffer = await response.arrayBuffer();
      }
      const path = asset.path.startsWith('/') ? asset.path.slice(1) : asset.path;
      zip.file(path, arrayBuffer);
    } catch (error) {
      console.error('Failed to add asset to ZIP:', asset.path, error);
      notifications.show(`Could not add ${asset.filename} to the archive`, "warning", 4000);
    }
  }

  try {
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `${get(project)?.name || 'project'}-sources.zip`);
  } catch (error) {
    console.error('Failed to export sources as ZIP:', error);
    notifications.show("Failed to export sources as ZIP", "error", 5000);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


let inhibNextZoomChange = false;

export function sendCommandToIframe(command: string, payload?: any) {
  const $previewIframe = get(previewIframe);
  if ($previewIframe?.contentWindow) {
    $previewIframe.contentWindow.postMessage({
      type: 'typst-command',
      command,
      payload
    }, '*');
  }
}

export function zoomIn() {
  sendCommandToIframe('zoom-in');
}

export function zoomOut() {
  sendCommandToIframe('zoom-out');
}


export function setZoom(zoom: number) {
  currentZoomValue.update(() => zoom);
  currentZoomMode.update(() => 'custom');
  sendCommandToIframe('set-zoom', { zoom, mode: 'custom' });
}

export function fitToWidth() {
  currentZoomMode.update(() => 'fit-width');
  inhibNextZoomChange = true;
  sendCommandToIframe('fit-width');
}

export function fitToHeight() {
  currentZoomMode.update(() => 'fit-height');
  inhibNextZoomChange = true;
  sendCommandToIframe('fit-height');
}

export function fitToPage() {
  currentZoomMode.update(() => 'fit-page');
  inhibNextZoomChange = true;
  sendCommandToIframe('fit-page');
}

export function reapplyCurrentZoomMode() {
  const $currentZoomMode = get(currentZoomMode);
  switch ($currentZoomMode) {
    case 'fit-width':
      fitToWidth();
      break;
    case 'fit-height':
      fitToHeight();
      break;
    case 'fit-page':
      fitToPage();
      break;
    case 'custom':
      const $currentZoomValue = get(currentZoomValue);
      setZoom($currentZoomValue);
      break;
  }
}


let syncTimeout: ReturnType<typeof setTimeout>;
const loadedFiles = new Map<string, { path: string; content: string }>();
const loadedAssets = new Map<string, { path: string; storage_path: string }>();
let workerReady = false;
// Mirrors the worker's own `hasCompiled`: once it is set, the worker only
// produces diffs, and only a `reset` makes it emit a full artifact again.
let workerHasCompiled = false;
// A sync walks the assets asynchronously, so a reset or a teardown can land
// while one is still in flight. Its remaining `addAsset` messages would reach a
// worker that no longer holds the sources they belong to, and the cache entries
// it writes afterwards would make the next sync skip re-adding them.
let syncGeneration = 0;

// A preview socket that has just opened called `svgDoc.reset()` and holds no
// document, so it needs a full artifact. Only the worker can produce one, and
// only after a reset — which also drops the sources it was given, so the caches
// mirroring them have to be dropped too or `_syncFilesAndAssets` would skip
// re-adding files the worker no longer has.
function resetWorkerDocument() {
  if (!worker || !workerReady || !workerHasCompiled) return;
  syncGeneration++;
  worker.postMessage({ type: 'reset' });
  workerHasCompiled = false;
  loadedFiles.clear();
  loadedAssets.clear();
}

function compile() {
  if (!worker || !workerReady) return;
  // The compiler emits one full artifact and diffs from then on, and the
  // preview iframe can only merge a diff into the document it already holds.
  // An artifact produced before the iframe is listening is therefore not just
  // lost: every later diff rebases onto a document it never received, its
  // renderer faults and drops the socket, and it reconnects into the same
  // fault forever. So hold compilation until the iframe has asked for the
  // document; `handleIframeSend` compiles as soon as it does.
  if (!initialized) {
    compileStatus.set('Preparing files...');
    return;
  }
  previewStatus.set('compiling');
  const mainFilePath = get(mainFile)?.path || '/main.typ';
  const path = mainFilePath.startsWith('/') ? mainFilePath : `/${mainFilePath}`;
  worker.postMessage({
    type: 'compile',
    payload: { mainFilePath: path },
  });
}

async function _syncFilesAndAssets() {
  // The worker registers its message handler immediately but only creates
  // `compiler` once the WASM bundle finishes loading; an `addFile`/`addAsset`
  // sent before that is silently dropped on the worker side (`if (!compiler)
  // return;`) with no signal back here. Without this guard this function still
  // records the file as loaded in `loadedFiles`/`loadedAssets`, so the real
  // sync that runs once the worker actually reports ready (see the
  // `'initialized'` handler) sees no diff and never re-sends it — the worker
  // ends up missing sources `compile()` then fails to find. Bailing out before
  // touching either cache keeps them honest until there is a worker to sync to.
  if (!worker || !workerReady) return;

  const generation = syncGeneration;

  // Handle files
  const currentFilesMap = new Map(get(files).map(f => [f.id, f]));

  // Remove deleted/moved files
  for (const [fileId, cached] of loadedFiles) {
    const current = currentFilesMap.get(fileId);
    if (!current || current.path !== cached.path) {
      const pathToRemove = cached.path.startsWith('/') ? cached.path : `/${cached.path}`;
      worker.postMessage({
        type: 'removeFile',
        payload: { path: pathToRemove }
      });
      loadedFiles.delete(fileId);
    }
  }

  // Add new/updated files
  for (const file of get(files)) {
    if (file.is_folder) continue;

    const cached = loadedFiles.get(file.id);
    const path = file.path.startsWith('/') ? file.path : `/${file.path}`;

    const content = get(projectYjs)?.ydoc.getText(`file-${file.id}`).toString() || '';
    if (!cached || cached.content !== content || cached.path !== file.path) {
      worker.postMessage({
        type: 'addFile',
        payload: { path, content }
      });
      loadedFiles.set(file.id, { path: file.path, content });
    }
  }

  // Handle assets
  const currentAssetsMap = new Map(get(assets).map(a => [a.id, a]));

  // Remove deleted/moved assets
  for (const [assetId, cached] of loadedAssets) {
    const current = currentAssetsMap.get(assetId);
    if (!current || current.path !== cached.path) {
      const pathToRemove = cached.path.startsWith('/') ? cached.path : `/${cached.path}`;
      worker.postMessage({
        type: 'removeFile',
        payload: { path: pathToRemove }
      });
      loadedAssets.delete(assetId);
    }
  }

  // Add new/updated assets
  for (const asset of get(assets)) {
    const cached = loadedAssets.get(asset.id);
    const path = asset.path.startsWith('/') ? asset.path : `/${asset.path}`;

    if (!cached || cached.storage_path !== asset.storage_path || cached.path !== asset.path) {
      try {
        let arrayBuffer: ArrayBuffer;

        // Try IndexedDB cache first
        const cachedBlob = await getCachedAsset(String(asset.project_id), asset.id, asset.storage_path);

        if (cachedBlob) {
          // Use cached data
          arrayBuffer = cachedBlob.blob;
        } else {
          // Fetch from API and cache
          const { url } = await assetsApi.getUrl(String(asset.project_id), asset.id);
          const response = await fetch(url);
          arrayBuffer = await response.arrayBuffer();

          // Store in IndexedDB cache (fire and forget)
          cacheAsset(String(asset.project_id), asset.id, asset.storage_path, asset.mime_type, arrayBuffer)
            .catch(err => console.warn('Failed to cache asset:', err));
        }

        if (generation !== syncGeneration) return;

        const uint8Array = new Uint8Array(arrayBuffer);

        worker.postMessage({
          type: 'addAsset',
          payload: { path, data: uint8Array }
        }, [uint8Array.buffer]); // Transfer ownership of the buffer

        loadedAssets.set(asset.id, { path: asset.path, storage_path: asset.storage_path });
      } catch (error) {
        console.error('Failed to load asset:', asset.path, error);
      }
    }
  }

  if (generation !== syncGeneration) return;

  // Trigger compilation
  compile();
}

function syncFilesAndAssets() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    _syncFilesAndAssets();
  }, 30); // 30ms debounce
}

let iframeMockReady = false;
let isPreviewZoomInitialized = false;
let initialized = false;

function handleIframeSend(data: string | ArrayBuffer) {
  if (typeof data === 'string') {
    if (data === 'current') {
      if (!iframeMockReady) {
        // First time receiving 'current' - iframe mock is ready
        iframeMockReady = true;
        initialized = true;
      }
      // The preview resets its document every time its socket opens, so a
      // 'current' after we have already compiled means the next artifact it
      // gets must be a full one, not a diff.
      resetWorkerDocument();
      // Iframe is requesting current state - trigger a recompile
      syncFilesAndAssets();
    }
  }
}

export const currentZoomValue = writable(1);
export const currentZoomMode = writable('custom');

export function handleIframeMessage(event: MessageEvent) {
  // Security: verify origin in production
  const { type, data, command, zoom, mode } = event.data || {};

  switch (type) {
    case 'typst-ws-mock-ready':
      // Iframe mock WebSocket is ready to receive connections - can be usefull ¯\_(ツ)_/¯
      break;

    case 'typst-ws-connect':
      // Iframe mock WebSocket is now connected - can be usefull too ¯\_(ツ)_/¯
      break;

    case 'typst-ws-send':
      handleIframeSend(data);
      break;

    case 'typst-ws-close':
      // Iframe mock WebSocket closed - can be usefull also ¯\_(ツ)_/¯
      break;

    case 'typst-zoom-changed':
      if (inhibNextZoomChange) {
        // Ignore this change - it was a backlash of our own command
        inhibNextZoomChange = false;
        return;
      }
      if (typeof zoom === 'number') {
        currentZoomValue.update(() => zoom);
        currentZoomMode.update(() => mode ?? 'custom');
      }
      break;

    case 'typst-request-current':
      // Iframe is requesting current state - trigger a recompile
      resetWorkerDocument();
      syncFilesAndAssets();
      break;

    case 'typst-zoom-initialized':
      isPreviewZoomInitialized = true;
      break;
  }
}


// The server is the source of truth for the file tree, and the projectSync WS
// echoes every mutation back to the client that made it (the REST handlers
// broadcast without a `sender`, so nobody is excluded). Rename / move / delete
// therefore never touch the `files` / `assets` stores here: `onFileUpdated` &co.
// do it. Only the create paths update locally, because the caller needs the
// created row straight away — and the server may have renamed it.

function errorDetail(error: unknown, fallback: string) {
  return (error as any)?.response?.data?.detail || fallback;
}

// Resolve the directory part of `path` to the id of an existing folder.
// `null` means the project root; `undefined` means the path names a folder that
// does not exist, so the caller must refuse rather than silently create at the
// root.
function resolveParentId(path: string): string | null | undefined {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash <= 0) return null;

  const dir = path.slice(0, lastSlash);
  const folderPath = dir.startsWith("/") ? dir : `/${dir}`;
  const folder = get(files).find((f) => f.is_folder && f.path === folderPath);
  return folder ? folder.id : undefined;
}

export async function newFile(path: string) {
  if (!get(canWrite)) return;

  const $projectId = get(projectId);
  const name = path.split('/').pop();
  if (!name) {
    throw new Error("Invalid file path");
  }

  const parentId = resolveParentId(path);
  if (parentId === undefined) {
    notifications.show(`No such folder for ${path}`, "error", 5000);
    return;
  }

  try {
    const createdFile = await filesApi.create($projectId, name, "", parentId);
    onFileCreated(createdFile);
    selectedAsset.set(null);
    selectFile(createdFile.id);
    if (createdFile.name !== name) {
      notifications.show(`Name already used, created as ${createdFile.name}`, "info");
    }
    return createdFile;
  } catch (error) {
    console.error("Failed to create file:", error);
    notifications.show(errorDetail(error, "Failed to create file"), "error", 5000);
    throw error;
  }
}

export async function newFolder(path: string) {
  if (!get(canWrite)) return;

  const $projectId = get(projectId);
  const name = path.split('/').pop();
  if (!name) {
    throw new Error("Invalid folder path");
  }

  const parentId = resolveParentId(path);
  if (parentId === undefined) {
    notifications.show(`No such folder for ${path}`, "error", 5000);
    return;
  }

  try {
    // Deliberately not selected: selecting a folder would steal focus from the
    // editor for something that has no content to show.
    const createdFolder = await filesApi.createFolder($projectId, name, parentId);
    onFileCreated(createdFolder);
    if (createdFolder.name !== name) {
      notifications.show(`Name already used, created as ${createdFolder.name}`, "info");
    }
    return createdFolder;
  } catch (error) {
    console.error("Failed to create folder:", error);
    notifications.show(errorDetail(error, "Failed to create folder"), "error", 5000);
    throw error;
  }
}

export async function renameFile(fileId: string, newName: string) {
  if (!get(canWrite)) return;

  try {
    await filesApi.update(get(projectId), fileId, { name: newName });
  } catch (error) {
    console.error("Failed to rename file:", error);
    notifications.show(errorDetail(error, "Failed to rename file"), "error", 5000);
    throw error;
  }
}

export async function moveFile(fileId: string, targetFolderId: string | null) {
  if (!get(canWrite)) return;

  const fileToMove = get(files).find((f) => f.id === fileId);
  if (!fileToMove || fileToMove.parent_id === targetFolderId) return;

  try {
    await filesApi.move(get(projectId), fileId, targetFolderId);
  } catch (error) {
    console.error("Failed to move file:", error);
    notifications.show(errorDetail(error, "Failed to move file"), "error", 5000);
    throw error;
  }
}

export async function deleteFile(fileId: string) {
  if (!get(canWrite)) return;

  try {
    await filesApi.delete(get(projectId), fileId);
  } catch (error) {
    console.error("Failed to delete file:", error);
    notifications.show(errorDetail(error, "Failed to delete file"), "error", 5000);
    throw error;
  }
}

export async function renameAsset(assetId: string, newName: string) {
  if (!get(canWrite)) return;

  try {
    await assetsApi.update(get(projectId), assetId, { filename: newName });
  } catch (error) {
    console.error("Failed to rename asset:", error);
    notifications.show(errorDetail(error, "Failed to rename asset"), "error", 5000);
    throw error;
  }
}

export async function moveAsset(assetId: string, targetFolderId: string | null) {
  if (!get(canWrite)) return;

  const assetToMove = get(assets).find((a) => a.id === assetId);
  if (!assetToMove || assetToMove.parent_id === targetFolderId) return;

  try {
    await assetsApi.move(get(projectId), assetId, targetFolderId);
  } catch (error) {
    console.error("Failed to move asset:", error);
    notifications.show(errorDetail(error, "Failed to move asset"), "error", 5000);
    throw error;
  }
}

export async function deleteAsset(assetId: string) {
  if (!get(canWrite)) return;

  try {
    await assetsApi.delete(get(projectId), assetId);
  } catch (error) {
    console.error("Failed to delete asset:", error);
    notifications.show(errorDetail(error, "Failed to delete asset"), "error", 5000);
    throw error;
  }
}


// These observers are what turns an edit — anyone's, local or remote — into a
// recompile and a refreshed search index.
let fileObservers = new Map<string, () => void>();
// The document the observers in `fileObservers` are attached to. Keying them by
// file id alone was not enough: `initContext` and
// `resetRealtimeConnectionsForWriteLoss` both swap the `Y.Doc` out from under
// them, and because the ids do not change, no observer was ever re-attached to
// the new document — edits went unnoticed and the preview stopped recompiling.
let observedYdoc: Y.Doc | null = null;

function clearFileObservers() {
  for (const unobserve of fileObservers.values()) {
    unobserve();
  }
  fileObservers.clear();
  observedYdoc = null;
}

function syncFileObservers() {
  const ydocValue = get(projectYjs)?.ydoc ?? null;

  if (ydocValue !== observedYdoc) {
    clearFileObservers();
    observedYdoc = ydocValue;
  }
  if (!ydocValue) return;

  const filesValue = get(files);

  // Clean up observers for deleted files
  for (const [fileId, unobserve] of fileObservers) {
    if (!filesValue.find((file) => file.id === fileId)) {
      unobserve();
      fileObservers.delete(fileId);
    }
  }

  // Set up observers for new files
  for (const file of filesValue) {
    if (!fileObservers.has(file.id)) {
      const ytext = getFileText(ydocValue, file.id);
      if (ytext) {
        // Yjs fires `observe` handlers synchronously, and for a local edit that
        // happens from inside yCollab's own CodeMirror `ViewPlugin.update()` —
        // i.e. while `view.dispatch()` for the keystroke is still on the call
        // stack. `updateSearchMatches()` can reach `updateMatchHighlights()`,
        // which calls `view.dispatch()` again; CodeMirror throws ("Calls to
        // EditorView.update are not allowed while an update is in progress"),
        // and its plugin error boundary disables yCollab for the view — after
        // that, local edits stop reaching Yjs entirely. Deferring past the
        // current call stack lets the in-flight dispatch finish first.
        const handler = () => {
          syncFilesAndAssets();
          setTimeout(updateSearchMatches, 0);
        };
        ytext.observe(handler);
        fileObservers.set(file.id, () => ytext.unobserve(handler));
      }
    }
  }
}

files.subscribe(syncFileObservers);
projectYjs.subscribe(syncFileObservers);

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

export interface FileSearchMatches {
  filePath: string;
  collapsed: boolean;
  matches: SearchMatch[];
}

export let searchText = writable("");
export let replaceText = writable("");
export let searchMatches = writable<FileSearchMatches[]>([]);

export let caseSensitiveSearch = writable(false);
export let wholeWordSearch = writable(false);
export let regexSearch = writable(false);

searchText.subscribe(() => {
  updateSearchMatches();
});

caseSensitiveSearch.subscribe(() => {
  updateSearchMatches();
});

wholeWordSearch.subscribe(() => {
  updateSearchMatches();
});

regexSearch.subscribe(() => {
  updateSearchMatches();
});

function updateSearchMatches() {
  const searchTextValue = get(searchText);
  if (!searchTextValue) {
    searchMatches.set([]);
    updateMatchHighlights();
    return;
  }

  const matchesMap = [];
  const filesValue = get(files);
  const yjsConnection = get(projectYjs);
  if (!yjsConnection?.ydoc) {
    searchMatches.set([]);
    updateMatchHighlights();
    return;
  }

  for (const file of filesValue) {
    const ytext = getFileText(yjsConnection.ydoc, file.id);
    if (!ytext) continue;

    const query = get(searchText);
    const caseSensitive = get(caseSensitiveSearch);
    const wholeWord = get(wholeWordSearch);
    const regex = get(regexSearch);

    const content = ytext.toString();
    const matches = content.matchAll(
      new RegExp(
        regex
          ? query
          : wholeWord
            ? `\\b${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`
            : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        caseSensitive ? "g" : "gi",
      ),
    );
    const searchMatches: SearchMatch[] = [];

    matches.forEach((match) => {
      const startIndex = match.index || 0;
      const endIndex = startIndex + match[0].length;

      const startLine = content.substring(0, startIndex).split("\n").length - 1;
      const endLine = content.substring(0, endIndex).split("\n").length - 1;

      const startChar =
        content.substring(0, startIndex).split("\n").pop()?.length || 0;
      const endChar =
        content.substring(0, endIndex).split("\n").pop()?.length || 0;

      const endLineContent = content.split("\n")[endLine] || "";

      const extraStartIndex = Math.max(0, startIndex - startChar);
      const extraEndIndex = Math.min(content.length, endIndex + (endLineContent.length - endChar));

      let preMatchText = content.substring(extraStartIndex, startIndex);
      const matchText = content.substring(startIndex, endIndex);
      let postMatchText = content.substring(endIndex, extraEndIndex);

      searchMatches.push({
        filePath: file.path,
        startLine,
        startChar,
        startIndex,
        endLine,
        endChar,
        endIndex,
        preMatchText,
        matchText,
        postMatchText,
      });
    });

    if (searchMatches.length > 0) {
      matchesMap.push({ filePath: file.path, matches: searchMatches, collapsed: false });
    }
  }

  searchMatches.set(matchesMap);
  updateMatchHighlights();
}

// The search-match ranges that belong to the file currently open in the editor,
// clamped to `docLength` and stripped of empty ranges (a mark decoration may not
// be empty). Read both when the editor state is rebuilt from scratch — see
// `getHighlightExtensions()` — and when a new search result set is dispatched.
function selectedFileMatchRanges(docLength: number) {
  const selectedFileValue = get(selectedFile);
  if (!selectedFileValue) return [];

  const fileMatches = get(searchMatches).find(
    (m) => m.filePath === selectedFileValue.path,
  );
  if (!fileMatches) return [];

  return fileMatches.matches
    .map((match) => ({
      from: Math.min(match.startIndex, docLength),
      to: Math.min(match.endIndex, docLength),
    }))
    .filter(({ from, to }) => from < to);
}

function updateMatchHighlights() {
  const viewValue = get(view);
  if (!viewValue) return;

  viewValue.dispatch({
    effects: setMatchHighlights.of(
      selectedFileMatchRanges(viewValue.state.doc.length),
    ),
  });
}

export function gotoSearchMatch(match: SearchMatch) {
  const file = get(files).find((f) => f.path === match.filePath);
  if (!file) {
    console.warn("File not found for search match:", match.filePath);
    return;
  }
  selectedFile.set(file);
  setTimeout(() => { // TODO: this is a hack, needs to wait for editor to load the file content
    navigateTo(match.startIndex, match.endIndex);
  }, 100);
}

export function replaceSearchMatch(match: SearchMatch) {
  const file = get(files).find((f) => f.path === match.filePath);
  const ydoc = get(projectYjs)?.ydoc;
  if (!file || !ydoc) return;

  const ytext = ydoc.getText(`file-${file.id}`);
  ytext.delete(match.startIndex, match.endIndex - match.startIndex);
  ytext.insert(match.startIndex, get(replaceText));
}

export function replaceAllInFile(filePath: string) {
  const file = get(files).find((f) => f.path === filePath);
  const ydoc = get(projectYjs)?.ydoc;
  if (!file || !ydoc) return;

  const query = get(searchText);
  const replace = get(replaceText);
  const regex = get(regexSearch)
  const caseSensitive = get(caseSensitiveSearch);
  const wholeWord = get(wholeWordSearch);

  const text = getFileText(ydoc, file.id)?.toString() || "";
  const newText = text.replace(
    new RegExp(
      regex
        ? query
        : wholeWord
          ? `\\b${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`
          : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      caseSensitive ? "g" : "gi",
    ),
    replace,
  );
  const ytext = ydoc.getText(`file-${file.id}`);
  ytext.delete(0, ytext.length);
  ytext.insert(0, newText);
}

export function replaceAllMatches() {
  for (const file of get(files)) {
    replaceAllInFile(file.path);
  }
}


import { StateEffect, StateField } from "@codemirror/state";
import { Decoration } from "@codemirror/view";

const setMatchHighlights = StateEffect.define<{ from: number; to: number }[]>();

const matchHighlight = Decoration.mark({
  class: "search-match"
});

function getHighlightExtensions() {
  const matchHighlightField = StateField.define({
    // Seeded from `searchMatches`, not empty: this field is re-created on every
    // `setState` (file switch, theme/settings change) and on every new view, and
    // the highlights must survive those rebuilds.
    create(state) {
      return Decoration.set(
        selectedFileMatchRanges(state.doc.length).map(({ from, to }) =>
          matchHighlight.range(from, to),
        ),
      );
    },

    update(decorations, tr) {
      decorations = decorations.map(tr.changes);

      for (const effect of tr.effects) {
        if (effect.is(setMatchHighlights)) {
          decorations = Decoration.set(
            effect.value.map(({ from, to }) =>
              matchHighlight.range(from, to)
            )
          );
        }
      }

      return decorations;
    },

    provide: field => EditorView.decorations.from(field)
  });
  return [matchHighlightField];
}

export function toggleFileCollapsed(fileMatches: FileSearchMatches) {
  searchMatches.update((files) =>
    files.map((file) =>
      file.filePath === fileMatches.filePath
        ? { ...file, collapsed: !file.collapsed }
        : file
    )
  );
}

export interface CommentDraft {
  text: string;
  range: { from: number; to: number };
  selectedText: string;
}

export let showCommentButton = writable(false);
export let commentButtonPosition = writable({ top: 0, left: 0 });
export let canWrite = writable(false);
export let canComment = writable(false);
export let canManageProject = writable(false);
export let commentDraft: Writable<CommentDraft | null> = writable(null);

currentUserRole.subscribe((role) => {
  canWrite.set(["owner", "admin", "writer"].includes(role));
  canComment.set(["owner", "admin", "writer", "commentor"].includes(role));
  canManageProject.set(["owner", "admin"].includes(role));
});

// A live role change must lock or unlock the open document without a reload:
// `createExtensions()` seeds both compartments from `canWrite`, so only an
// already-built view needs reconfiguring here.
canWrite.subscribe((writeAllowed) => {
  const viewValue = get(view);
  if (!viewValue) return;
  viewValue.dispatch({
    effects: [
      readOnlyCompartment.reconfigure(EditorState.readOnly.of(!writeAllowed)),
      editableCompartment.reconfigure(EditorView.editable.of(writeAllowed)),
    ],
  });
});

function getSelection() {
  const viewValue = get(view);
  if (!viewValue) return null;
  const { from, to } = viewValue.state.selection.main;
  return {
    from,
    to,
    text: viewValue.state.doc.sliceString(from, to),
  };
}

export function addComment() {
  if (!get(canComment)) return;

  const selection = getSelection();
  if (!selection || selection.from === selection.to) {
    return;
  }

  leftPanelTab.set("comments");

  // Create a draft comment and open it in the panel
  commentDraft.set({
    text: "",
    range: { from: selection.from, to: selection.to },
    selectedText: selection.text,
  });

  // Hide the button
  showCommentButton.set(false);
}

function getCommentContextFromSelection(from: number, to: number) {
  if (!get(view)) {
    return {
      anchorRelJson: null,
      headRelJson: null,
    };
  }

  let anchorRelJson: string | null = null;
  let headRelJson: string | null = null;
  const ytextValue = get(ytext);
  if (ytextValue) {
    try {
      const anchor = Y.createRelativePositionFromTypeIndex(ytextValue, from);
      const head = Y.createRelativePositionFromTypeIndex(ytextValue, to);
      anchorRelJson = JSON.stringify(Y.relativePositionToJSON(anchor));
      headRelJson = JSON.stringify(Y.relativePositionToJSON(head));
    } catch (error) {
      console.warn("Failed to create relative anchor positions for comment:", error);
    }
  }

  return {
    anchorRelJson,
    headRelJson,
  };
}

async function createComment(payload: {
  file_id: string;
  content: string;
  anchor_rel_json: string | null;
  head_rel_json: string | null;
}) {
  if (!get(canComment)) return;

  const thread = await commentsApi.createThread(get(projectId), {
    file_id: payload.file_id,
    content: payload.content,
    anchor_rel_json: payload.anchor_rel_json,
    head_rel_json: payload.head_rel_json,
  });

  applyThreadUpdate(thread);
  activeCommentId.set(thread.id);
}

export async function submitNewComment() {
  if (!get(canComment)) return;

  const commentDraftValue = get(commentDraft);
  const selectedFileValue = get(selectedFile);
  if (!commentDraftValue || !selectedFileValue) return;

  const context = getCommentContextFromSelection(
    commentDraftValue.range.from,
    commentDraftValue.range.to,
  );

  try {
    await createComment({
      file_id: selectedFileValue.id,
      content: commentDraftValue.text,
      anchor_rel_json: context.anchorRelJson,
      head_rel_json: context.headRelJson,
    });
  } catch (error) {
    console.error("Failed to create comment:", error);
    return;
  }

  commentDraft.set(null);
}

export function cancelNewComment() {
  commentDraft.set(null);
}

export function selectComment(comment: Comment) {
  activeCommentId.set(comment.id);
  scrollToComment(comment);
  leftPanelTab.set("comments");
}

function resolveRangeFromComment(comment: Comment): { from: number; to: number } | null {
  const doc = get(projectYjs)?.ydoc;
  if (!doc) return null;
  // Preferred path: resolve persisted Yjs relative anchors against current text.
  if (comment.anchorRelJson && comment.headRelJson) {
    try {
      const anchor = Y.createRelativePositionFromJSON(JSON.parse(comment.anchorRelJson));
      const head = Y.createRelativePositionFromJSON(JSON.parse(comment.headRelJson));
      const anchorPos = Y.createAbsolutePositionFromRelativePosition(anchor, doc);
      const headPos = Y.createAbsolutePositionFromRelativePosition(head, doc);
      if (anchorPos && headPos) {
        return {
          from: Math.min(anchorPos.index, headPos.index),
          to: Math.max(anchorPos.index, headPos.index),
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function scrollToComment(comment: Comment) {
  if (!comment) return;

  const range = resolveRangeFromComment(comment);
  if (range) {
    get(view)?.dispatch({
      selection: { anchor: range.from, head: range.to },
      scrollIntoView: true,
    });
  }
}

export function formatCommentDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export async function resolveComment(commentId: string) {
  if (!get(canComment)) return;

  const thread = await commentsApi.updateThread(get(projectId), commentId, {
    status: "resolved",
  });
  applyThreadUpdate(thread);
}

export async function reopenComment(commentId: string) {
  if (!get(canComment)) return;

  const thread = await commentsApi.updateThread(get(projectId), commentId, {
    status: "open",
  });
  applyThreadUpdate(thread);
}

export async function deleteComment(commentId: string) {
  if (!get(canManageProject)) return;

  const thread = await commentsApi.updateThread(get(projectId), commentId, {
    status: "deleted",
  });
  applyThreadUpdate(thread);
}

export async function replyComment(commentId: string, content: string) {
  if (!get(canComment)) return;

  const reply = await commentsApi.createReply(get(projectId), commentId, {
    content,
  });
  applyReplyUpdate(commentId, reply);
}

// --- Comment decorations -----------------------------------------------------
//
// `commentsExtension()` has always been installed, but nothing ever dispatched
// into it, so commented ranges had no highlight and clicking one did nothing.
// The ranges come from the threads themselves — their Yjs relative anchors,
// resolved by `resolveRangeFromComment` against the live document — so they
// follow other people's edits without any extra bookkeeping.

function syncCommentDecorations() {
  const viewValue = get(view);
  if (!viewValue) return;

  const docLength = viewValue.state.doc.length;
  const ranges = new Map<string, { from: number; to: number }>();

  for (const comment of get(comments)) {
    if (comment.resolved) continue;
    const range = resolveRangeFromComment(comment);
    if (!range) continue;
    const from = Math.min(range.from, docLength);
    const to = Math.min(range.to, docLength);
    // A mark decoration may not be empty, and a thread whose anchored text has
    // been deleted resolves to exactly that.
    if (to <= from) continue;
    ranges.set(comment.id, { from, to });
  }

  viewValue.dispatch({
    effects: [
      updateCommentsEffect.of({ comments: ranges }),
      setActiveCommentEffect.of(get(activeCommentId)),
    ],
  });
}

view.subscribe(() => {
  syncCommentDecorations();
});

comments.subscribe(() => {
  syncCommentDecorations();
});

activeCommentId.subscribe((commentId) => {
  get(view)?.dispatch({ effects: setActiveCommentEffect.of(commentId) });
});

export function destroyContext() {
  contextGeneration++;

  destroyRealtimeConnections();

  worker?.terminate();
  workerInitialized = false;
  workerReady = false;
  workerHasCompiled = false;
  syncGeneration++;
  // The next project mounts a fresh iframe with an empty document. Leaving
  // these set made us treat it as ready for diffs before it had asked for
  // anything, and it would never receive a full artifact.
  iframeMockReady = false;
  initialized = false;
  isPreviewZoomInitialized = false;
  if (syncTimeout) clearTimeout(syncTimeout);

  get(view)?.destroy();
  view.set(null);

  setUndoManager(null);

  clearFileObservers();

  loadedFiles.clear();
  loadedAssets.clear();

  projectId.set("");
  project.set(null);
  files.set([]);
  assets.set([]);
  comments.set([]);
  commentors.set([]);
  diagnostics.set([]);
  selectedFile.set(null);
  mainFile.set(null);
  selectedAsset.set(null);
  editorNewCommentDraft.set(null);
  activeCommentId.set(null);
  commentDraft.set(null);
  currentUserRole.set("reader");
  initError.set(null);
  searchText.set("");
  replaceText.set("");
  searchMatches.set([]);
  caseSensitiveSearch.set(false);
  wholeWordSearch.set(false);
  regexSearch.set(false);
  showCommentButton.set(false);
  commentButtonPosition.set({ top: 0, left: 0 });
  currentZoomValue.set(1);
  currentZoomMode.set("custom");
  compileStatus.set("");
  previewStatus.set("idle");
}
