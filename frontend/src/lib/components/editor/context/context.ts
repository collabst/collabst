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
import { indentLess, indentMore } from "@codemirror/commands";
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
import { commentsExtension } from "$lib/codemirror/comments";
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


let wrapLines = true;
let errorLines = new Set<number>();
let editable = true;

function getLineWrappingExtensions() {
  return wrapLines ? [EditorView.lineWrapping] : [];
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
      return [typst()];
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
export const editorNewCommentDraft = writable<{
  text: string;
  range: { from: number; to: number };
  selectedText: string;
} | null>(null);
export const projectSync = writable<ReturnType<typeof createProjectSync> | null>(null);
export const commentSync = writable<ReturnType<typeof createCommentSync> | null>(null);
export const activeCommentId = writable<string | null>(null);
export const view = writable<EditorView | null>(null);
let undoManager: Y.UndoManager;
export const ytext = derived([ydoc, selectedFile], ([$ydoc, $selectedFile]) => {
  const ytextValue = $ydoc?.getText(`file-${$selectedFile?.id}`);
  if (ytextValue) {
    undoManager = new Y.UndoManager(ytextValue);
  }
  return ytextValue;
});
export const previewIframe = writable<HTMLIFrameElement | undefined>();
export const currentUserRole = writable<"owner" | "admin" | "writer" | "commentor" | "reader">("reader");
export const context = {
  projectId,
  leftPanelTab,
  files,
  assets,
  selectedFile,
  editorElement,
  ydoc,
  ytext,
  view,
  previewIframe,
  projectSync,
};


export function toggleWrap(prefix: string, suffix: string) {
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

function createUndoRedoKeymap() {
  if (!undoManager) {
    return keymap.of([]);
  }

  return keymap.of([
    {
      key: "Mod-z",
      run: (view) => {
        if (undoManager && undoManager.canUndo()) {
          undoManager.undo();
          return true;
        }
        return false;
      },
    },
    {
      key: "Mod-Shift-z",
      run: (view) => {
        if (undoManager && undoManager.canRedo()) {
          undoManager.redo();
          return true;
        }
        return false;
      },
    },
    {
      key: "Mod-y",
      run: (view) => {
        if (undoManager && undoManager.canRedo()) {
          undoManager.redo();
          return true;
        }
        return false;
      },
    },
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
  const collabReady = ytextValue && provider && undoManager;
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
    readOnlyCompartment.of(EditorState.readOnly.of(!editable)),
    editableCompartment.of(EditorView.editable.of(editable)),
    ...(collabReady ? [yCollab(ytextValue, provider.awareness, { undoManager })] : []),
    createUndoRedoKeymap(),
    commentsExtension(),
    highlightCompartement.of(getHighlightExtensions()),
  ];
  return extensions;
}


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

export async function initContext(projectIdValue: string) {
  projectId.set(projectIdValue);
  await loadProject();
  projectYjs.set(
    createProjectYjs(projectIdValue, get(auth).user, get(auth).token),
  );
  projectSync.set(createProjectSync(projectIdValue, {
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
  const newFiles = await filesApi.list(projectIdValue);
  files.update(() => newFiles);
  commentSync.set(createCommentSync(
    projectIdValue,
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
  await initSelectedFile();
  initWorker();
}

view.subscribe(() => {
  setupSelectionListener();
});

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

editorElement.subscribe(async (el) => {
  const extensions = await createExtensions();
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
}

ytext.subscribe(async (newYText) => {
  updateEditorContent();
});


view.subscribe(async (newView) => {
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
  updateLinter();
}

let worker: Worker;

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

export function initWorker() {
  if (!worker) {
    worker = new Worker(
      new URL('/src/lib/preview/typst-worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = async (e) => {
      const { type, vectorData, compileTime, isFirstCompile, diagnostics } = e.data;
      onDiagnostics(diagnostics);

      switch (type) {
        case 'status':
          status = e.data.message;
          break;

        case 'initialized':
          workerReady = true;
          status = compileEnabled
            ? 'Compiler ready - waiting for iframe...'
            : 'Preparing files...';

          // Force a sync only when file hydration is ready.
          if (compileEnabled) {
            syncFilesAndAssets();
          }
          reapplyCurrentZoomMode();
          break;

        case 'compiled':
          if (!initialized) {
            status = 'Waiting for iframe...';
            return;
          }

          if (!vectorData) {
            status = `Ready (${compileTime}ms) - no output`;
            return;
          }

          try {
            status = 'Rendering...';

            if (separateWindow) {
              sendVectorDataToWindow(separateWindow, vectorData, isFirstCompile);
            } else {
              // Send vector data to iframe
              sendVectorDataToIframe(vectorData, isFirstCompile);
            }

            status = `Ready (${compileTime}ms)`;
          } catch (error: any) {
            status = `Render error: ${error.message}`;
            console.error('Render error:', error);
          }
          break;

        case 'error':
          status = `Compile error: ${e.data.error}`;
          console.error('Compilation error:', e.data);
          break;

        case 'pdf':
          const pdfBlob = new Blob([e.data.pdfData], { type: 'application/pdf' });
          const pdfUrl = URL.createObjectURL(pdfBlob);
          const pdfLink = document.createElement('a');
          pdfLink.href = pdfUrl;
          // get project name
          const projectName = get(project)?.name || 'document';
          pdfLink.download = `${projectName || 'document'}.pdf`;
          document.body.appendChild(pdfLink);
          pdfLink.click();
          document.body.removeChild(pdfLink);
          URL.revokeObjectURL(pdfUrl);
          break;

        case 'reset':
          console.log('Worker: Resetting document as requested');
          // if (typstDoc) typstDoc.reset();
          status = 'Reset complete';
          break;
      }
    };

    worker.onerror = (e) => {
      const errorMsg = e.message || (e.error as any)?.message || 'Unknown error';
      status = `Worker error: ${errorMsg}`;
      console.error('Worker error:', e);
    };
  }
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

function compile() {
  if (!worker || !workerReady) return;
  const mainFilePath = get(mainFile)?.path || '/main.typ';
  const path = mainFilePath.startsWith('/') ? mainFilePath : `/${mainFilePath}`;
  worker.postMessage({
    type: 'compile',
    payload: { mainFilePath: path },
  });
}

async function _syncFilesAndAssets() {
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
let previewStatus: 'Ready' | 'Compiling' | 'Error' = 'Ready';
let isPreviewZoomInitialized = false;
let initialized = false;

function handleIframeSend(data: string | ArrayBuffer) {
  if (typeof data === 'string') {
    if (data === 'current') {
      if (!iframeMockReady) {
        // First time receiving 'current' - iframe mock is ready
        iframeMockReady = true;
        initialized = true;
        previewStatus = 'Ready';
      }
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
      syncFilesAndAssets();
      break;

    case 'typst-zoom-initialized':
      isPreviewZoomInitialized = true;
      break;
  }
}


export async function newFile(path: string) {
  const $projectId = get(projectId);
  const name = path.split('/').pop();
  if (!name) {
    throw new Error("Invalid file path");
  }
  const parentId = null;
  const content = "";
  await filesApi.create($projectId, name, content, parentId)
}

export async function newFolder(path: string) {
  const $projectId = get(projectId);
  const name = path.split('/').pop();
  if (!name) {
    throw new Error("Invalid folder path");
  }
  const parentId = null;
  await filesApi.createFolder($projectId, name, parentId)
}


let fileObservers = new Map<string, () => void>();

files.subscribe((filesValue) => {
  const yjsConnection = get(projectYjs);
  if (!yjsConnection?.ydoc) return;

  const ydoc = yjsConnection.ydoc;

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
      const ytext = getFileText(ydoc, file.id);
      if (ytext) {
        const handler = () => {
          syncFilesAndAssets();
          updateSearchMatches();
        };
        ytext.observe(handler);
        fileObservers.set(file.id, () => ytext.unobserve(handler));
      }
    }
  }
});

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
    return;
  }

  const matchesMap = [];
  const filesValue = get(files);
  const yjsConnection = get(projectYjs);
  if (!yjsConnection?.ydoc) return;

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
      matchesMap.push({ filePath: file.path.slice(1), matches: searchMatches, collapsed: false });
    }
  }

  searchMatches.set(matchesMap);
  updateMatchHighlights();
}

function updateMatchHighlights() {
  const selectedFileValue = get(selectedFile);
  const searchMatchesValue = get(searchMatches);
  const viewValue = get(view);
  if (!selectedFileValue || !viewValue) return;

  const fileMatches = searchMatchesValue.find(
    (m) => m.filePath === selectedFileValue.path,
  );
  if (!fileMatches) {
    viewValue.dispatch({
      effects: setMatchHighlights.of([]),
    });
    return;
  }

  const highlights = fileMatches.matches.map((match) => ({
    from: match.startIndex,
    to: match.endIndex,
  }));
  viewValue.dispatch({
    effects: setMatchHighlights.of(highlights),
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
    create() {
      return Decoration.none;
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
export let canComment = writable(false);
export let canManageProject = writable(false);
export let commentDraft: Writable<CommentDraft | null> = writable(null);

currentUserRole.subscribe((role) => {
  canComment.set(["owner", "admin", "writer", "commentor"].includes(role));
  canManageProject.set(["owner", "admin"].includes(role));
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

function setupSelectionListener() {
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
