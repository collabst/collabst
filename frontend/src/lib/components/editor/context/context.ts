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
import { commentsApi, filesApi, projectsApi } from "$lib/services/api";
import { createProjectYjs, type YjsConnection } from "$lib/yjs";
import { auth } from "$lib/stores/auth";
import { createProjectSync } from "$lib/projectSync";
import type { Asset, CommentThreadDTO, Project, Comment, CommentReplyDTO } from "$lib/types";
import { removeCachedAsset } from "$lib/utils/assetCache";
import { notifications } from "$lib/stores/notifications";
import { goto } from "$app/navigation";
import { createCommentSync } from "$lib/commentSync";
import { tick } from "svelte";

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
export const project = writable<Project | null>(null);
export const leftPanelTab = writable<LeftPanelTab>("files");
export const files = writable<File[]>([]);
export const assets = writable<Asset[]>([]);
export const comments = writable<Comment[]>([]);
export const selectedFile = writable<File | null>(null);
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
export const ytext = derived([ydoc, selectedFile], ([$ydoc, $selectedFile]) => {
  return $ydoc?.getText(`file-${$selectedFile?.id}`);
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

let isConnected = false;
let isSynced = false;
let isLocalSynced = false;

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
        if (reconnected && get(selectedFile)?.is_folder) {
          void loadCommentsForSelectedFile(get(selectedFile));
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

    if (get(selectedFile)?.is_folder) {
      await loadCommentsForSelectedFile(get(selectedFile));
    }
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

async function loadCommentsForSelectedFile(file: File | null) {
  if (!file || file.is_folder || selectedAsset) {
    comments.set([]);
    return;
  }

  try {
    const threads = await commentsApi.listFileThreads(get(projectId), file.id);
    if (get(selectedFile)?.id !== file.id) {
      return;
    }

    comments.set(threads
      .filter((thread) => thread.status !== "deleted")
      .map(mapThreadToComment)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
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
  files.set(await filesApi.list(projectIdValue));
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
  commentSync.set(createCommentSync(
    projectIdValue,
    {
      onConnected: ({ reconnected }) => {
        const selectedFileValue = get(selectedFile);
        if (reconnected && selectedFileValue && !selectedFileValue.is_folder) {
          void loadCommentsForSelectedFile(selectedFileValue);
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
      // handleIframeSend(data);
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
      // syncFilesAndAssets();
      break;

    case 'typst-zoom-initialized':
      // isPreviewZoomInitialized = true;
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
