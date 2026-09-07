import type { createCommentSync } from "$lib/commentSync";
import type { createProjectSync } from "$lib/projectSync";
import type {
  Asset,
  Comment,
  Diagnostic,
  Project,
  UserProfile,
} from "$lib/types";
import type { YjsConnection } from "$lib/yjs";
import type {
  CommentDraft,
  File,
  FileMenuState,
  FileSearchMatches,
  LeftPanelTab,
  OutlineEntry,
  PendingDeletion,
} from "./types";
import type { EditorView } from "@codemirror/view";
import { derived, writable } from "svelte/store";

/**
 * Every store the editor context owns, in one place, so the mutually recursive
 * behaviour modules under `context/` can share state without an import cycle
 * putting a `writable()` in the temporal dead zone.
 *
 * Rule: every import here is a top-level `import type` (the inline `{ type Foo }`
 * modifier still emits a side-effecting `import`, which reintroduces the cycle),
 * and every type comes from `./types`, which imports nothing of ours.
 */

/** What a `wireX()` returns: call it to undo the wiring it set up. */
export type Disposer = () => void;

// --- Preview -----------------------------------------------------------------

/** The preview panel's iframe element, bound by `PreviewPanel.svelte`. */
export const previewIframe = writable<HTMLIFrameElement | undefined>();

// The compiler's human-readable line ("Ready (123 ms)", "Compile error: …") and
// the coarse lifecycle state the preview toolbar renders.
export const compileStatus = writable<string>("");
export const previewStatus = writable<"idle" | "compiling" | "ready" | "error">("idle");

/** Whether the preview currently lives in its own window. */
export const separatePreviewOpen = writable(false);
/**
 * The popup's root element while the preview lives there, so the toolbar can be
 * mounted into that document; `null` whenever the preview is in the split view.
 */
export const separatePreviewHost = writable<HTMLElement | null>(null);

export const currentZoomValue = writable(1);
export const currentZoomMode = writable('custom');

// --- Search ------------------------------------------------------------------

export const searchText = writable("");
export const replaceText = writable("");
export const searchMatches = writable<FileSearchMatches[]>([]);

export const caseSensitiveSearch = writable(false);
export const wholeWordSearch = writable(false);
export const regexSearch = writable(false);

// --- Comments ----------------------------------------------------------------

export const comments = writable<Comment[]>([]);
export const commentors = writable<UserProfile[]>([]);
export const activeCommentId = writable<string | null>(null);
// Written by the comments panel, read by the editor to emphasise the range.
export const hoveredCommentId = writable<string | null>(null);
export const editorNewCommentDraft = writable<{
  text: string;
  range: { from: number; to: number };
  selectedText: string;
} | null>(null);
export const commentDraft = writable<CommentDraft | null>(null);
export const showCommentButton = writable(false);
export const commentButtonPosition = writable({ top: 0, left: 0 });

// --- Files and assets --------------------------------------------------------

export const files = writable<File[]>([]);
export const assets = writable<Asset[]>([]);
export const selectedFile = writable<File | null>(null);
/** The compiler's entry point. */
export const mainFile = writable<File | null>(null);
export const selectedAsset = writable<Asset | null>(null);
/** Object URL for `selectedAsset`, or `null` while it is being fetched. */
export const selectedAssetUrl = writable<string | null>(null);

// Explorer UI state.
export const expandedFolders = writable<Set<string>>(new Set());
export const renamingNodeId = writable<string | null>(null);
export const fileMenu = writable<FileMenuState | null>(null);
export const pendingDeletion = writable<PendingDeletion | null>(null);
export const draggedNodeId = writable<string | null>(null);

// --- Project -----------------------------------------------------------------

export const projectId = writable<string>("");
export const project = writable<Project | null>(null);
export const projectYjs = writable<YjsConnection | null>(null);
export const ydoc = derived(
  projectYjs,
  ($projectYjs) => $projectYjs?.ydoc || null,
);
export const awarenessStates = writable<[number, Record<string, any>][]>([]);
export const projectSync = writable<ReturnType<typeof createProjectSync> | null>(null);
export const commentSync = writable<ReturnType<typeof createCommentSync> | null>(null);
export const currentUserRole = writable<
  "owner" | "admin" | "writer" | "commentor" | "reader"
>("reader");
export const canWrite = writable(false);
export const canComment = writable(false);
export const canManageProject = writable(false);
/** Set when `initContext` gives up, so the route can show why. */
export const initError = writable<string | null>(null);

// --- Editor ------------------------------------------------------------------
//
// `ytext` is deliberately *not* here: it is a derived store with a side effect
// (it builds the Yjs `UndoManager` for the file it resolves to), so it lives
// with its owner in `editor/view.ts` rather than in this dependency-free layer.

export const view = writable<EditorView | null>(null);
export const editorElement = writable<HTMLDivElement | undefined>();
export const leftPanelTab = writable<LeftPanelTab>("files");
export const diagnostics = writable<Diagnostic[]>([]);
export const outline = writable<OutlineEntry[]>([]);

// Find in the open file. Distinct from the global search panel above: this one
// drives CodeMirror's own search state on the open document.
export const findOpen = writable(false);
export const findQuery = writable("");
export const findReplace = writable("");
export const findCaseSensitive = writable(false);
export const findWholeWord = writable(false);
export const findRegex = writable(false);
export const findMatchCount = writable(0);
export const findMatchIndex = writable(0);

/** Reset every store this module owns; called by `initContext` and `destroyContext`. */
export function resetState() {
  // Preview
  currentZoomValue.set(1);
  currentZoomMode.set("custom");
  compileStatus.set("");
  previewStatus.set("idle");
  separatePreviewOpen.set(false);
  separatePreviewHost.set(null);

  // Search
  searchText.set("");
  replaceText.set("");
  searchMatches.set([]);
  caseSensitiveSearch.set(false);
  wholeWordSearch.set(false);
  regexSearch.set(false);

  // Comments
  comments.set([]);
  commentors.set([]);
  activeCommentId.set(null);
  hoveredCommentId.set(null);
  editorNewCommentDraft.set(null);
  commentDraft.set(null);
  showCommentButton.set(false);
  commentButtonPosition.set({ top: 0, left: 0 });

  // Files and assets. The blob URLs behind `selectedAssetUrl` are revoked
  // separately by `releaseAssetBlobUrls()` in `files/`.
  files.set([]);
  assets.set([]);
  selectedFile.set(null);
  mainFile.set(null);
  selectedAsset.set(null);
  selectedAssetUrl.set(null);
  expandedFolders.set(new Set<string>());
  renamingNodeId.set(null);
  fileMenu.set(null);
  pendingDeletion.set(null);
  draggedNodeId.set(null);

  // Project
  projectId.set("");
  project.set(null);
  currentUserRole.set("reader");
  initError.set(null);

  // Editor
  diagnostics.set([]);
  outline.set([]);
  findOpen.set(false);
  findQuery.set("");
  findReplace.set("");
  findMatchCount.set(0);
  findMatchIndex.set(0);
}
