<script lang="ts">
  import CodeEditor from "$lib/components/CodeEditor.svelte";
  import AssetMetadata from "$lib/components/editor/AssetMetadata.svelte";
  import {
    IconButton,
    Tooltip,
    ToolButton,
    DropdownToolButton,
  } from "$lib/components/ui";
  import MessageSquarePlus from "@lucide/svelte/icons/message-square-plus";
  import Bold from "@lucide/svelte/icons/bold";
  import Italic from "@lucide/svelte/icons/italic";
  import Underline from "@lucide/svelte/icons/underline";
  import List from "@lucide/svelte/icons/list";
  import ListOrdered from "@lucide/svelte/icons/list-ordered";
  import Sigma from "@lucide/svelte/icons/sigma";
  import Columns2 from "@lucide/svelte/icons/columns-2";
  import Code from "@lucide/svelte/icons/code";
  import Redo from "@lucide/svelte/icons/redo";
  import ArrowDownToLine from "@lucide/svelte/icons/arrow-down-to-line";
  import ArrowUpFromLine from "@lucide/svelte/icons/arrow-up-from-line";
  import PencilLine from "@lucide/svelte/icons/pencil-line";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import MoreHorizontal from "@lucide/svelte/icons/ellipsis";
  import { onDestroy } from "svelte";
  import { setCurrentTracker, updateCommentsEffect } from "$lib/codemirror/comments";
  import type {
    File as ProjectFile,
    Asset,
    Comment,
    Diagnostic,
  } from "$lib/types";
  import { revokeBlobUrl } from "$lib/utils/assetCache";
  import * as Y from "yjs";
  import type { WebsocketProvider } from "y-websocket";
  import type { Component } from "svelte";

  interface EditorPaneProps {
    selectedFile: ProjectFile | null;
    selectedAsset: Asset | null;
    assets: Asset[];
    ytext: Y.Text | null;
    provider: WebsocketProvider | null;
    isConnected: boolean;
    onGetAssetUrl: ((assetId: string) => Promise<string>) | null;
    onGetAssetBlob: ((asset: Asset) => Promise<string>) | null;
    ydoc: Y.Doc | null;
    currentUserId: string;
    diagnostics?: Diagnostic[];
    wrapLines?: boolean;
    showToolbar?: boolean;
    separateWindow?: Window | null;
    closeSeparatePreview?: () => void;
    onRenameAsset?: ((assetId: string) => void) | null;
    onDeleteAsset?: ((assetId: string) => void) | null;
    files?: ProjectFile[];
    commentsForAnchors?: Comment[];
    onCommentsChange?: (comments: Comment[]) => void;
    onNewCommentDraftChange?: (draft: { text: string; range: { from: number; to: number }; selectedText: string } | null) => void;
    activeCommentId?: string | null;
    onCommentClick?: (commentId: string) => void;
    onCommentHover?: (commentId: string | null) => void;
    onDocChange?: () => void;
    onCreateComment?: (payload: {
      file_id: string;
      content: string;
      anchor_rel_json: string | null;
      head_rel_json: string | null;
    }) => Promise<void> | void;
    onResolveComment?: (commentId: string) => Promise<void> | void;
    onDeleteComment?: (commentId: string) => Promise<void> | void;
    onReplyComment?: (commentId: string, content: string) => Promise<void> | void;
    canWrite?: boolean;
    canComment?: boolean;
    canModerateComments?: boolean;
  }

  let {
    selectedFile,
    selectedAsset,
    assets = [],
    ytext,
    provider,
    isConnected,
    onGetAssetUrl = null,
    onGetAssetBlob = null,
    ydoc,
    currentUserId,
    diagnostics = [],
    wrapLines = true,
    showToolbar = true,
    separateWindow = null,
    closeSeparatePreview = () => {},
    onRenameAsset = null,
    onDeleteAsset = null,
    files = [],
    commentsForAnchors = [],
    onCommentsChange,
    onNewCommentDraftChange,
    activeCommentId = null,
    onCommentClick,
    onCommentHover,
    onDocChange,
    onCreateComment = undefined,
    onResolveComment = undefined,
    onDeleteComment = undefined,
    onReplyComment = undefined,
    canWrite = true,
    canComment = true,
    canModerateComments = false,
  }: EditorPaneProps = $props();

  // Simple blob URL cache - keyed by asset ID
  const blobUrlCache: Record<string, string> = {};
  let currentBlobUrl = $state<string | null>(null);
  let currentBlobAssetId = $state<string | null>(null);

  // Load blob URL for an asset (with caching)
  async function loadAssetBlobUrl(asset: Asset) {
    const assetId = asset.id;

    // Already cached?
    if (blobUrlCache[assetId]) {
      currentBlobUrl = blobUrlCache[assetId];
      currentBlobAssetId = assetId;
      return;
    }

    // Load and cache
    if (onGetAssetBlob) {
      try {
        const url = await onGetAssetBlob(asset);

        // Revoke old blob URL if replacing (e.g., asset was updated)
        if (blobUrlCache[assetId]) {
          revokeBlobUrl(blobUrlCache[assetId]);
        }

        blobUrlCache[assetId] = url;
        // Only set if still viewing the same asset
        if (selectedAsset?.id === assetId) {
          currentBlobUrl = url;
          currentBlobAssetId = assetId;
        }
      } catch (err) {
        console.error("Failed to load asset blob:", assetId, err);
      }
    }
  }

  // Watch selectedAsset and load its blob URL
  $effect(() => {
    if (selectedAsset) {
      // Check cache first (sync)
      if (blobUrlCache[selectedAsset.id]) {
        currentBlobUrl = blobUrlCache[selectedAsset.id];
        currentBlobAssetId = selectedAsset.id;
      } else {
        // Clear current to show loading (prevents showing wrong asset type)
        currentBlobUrl = null;
        currentBlobAssetId = null;
        loadAssetBlobUrl(selectedAsset);
      }
    } else {
      currentBlobUrl = null;
      currentBlobAssetId = null;
    }
  });

  // Only show blob URL if it matches the selected asset
  let safeBlobUrl = $derived(
    selectedAsset && currentBlobAssetId === selectedAsset.id
      ? currentBlobUrl
      : null,
  );

  // Cleanup on unmount
  onDestroy(() => {
    setCurrentTracker(null);
    for (const url of Object.values(blobUrlCache)) {
      revokeBlobUrl(url);
    }
  });

  let fileName = $derived(
    selectedFile
      ? selectedFile.path?.startsWith("/")
        ? selectedFile.path.slice(1)
        : selectedFile.path
      : "",
  );

  let codeEditor: any = $state(null);
  let comments = $state<Comment[]>([]);
  let newCommentDraft = $state<{
    text: string;
    range: { from: number; to: number };
    selectedText: string;
  } | null>(null);
  let commentsVersion = $state(0); // Simple counter to trigger reactivity
  let showCommentButton = $state(false);
  let commentButtonPosition = $state({ top: 0, left: 0 });
  let editorContainer: HTMLElement | null = $state(null);
  let listenersSetup = false;

  // Dynamic toolbar overflow handling
  let toolbarElement = $state<HTMLElement | null>(null);
  // Overflow buttons always have onclick defined (filtered in checkToolbarOverflow)
  let overflowButtons = $state<
    Array<{ label: string; icon?: Component; onclick: () => void }>
  >([]);

  // Export editor action methods
  export function undo() {
    if (codeEditor) {
      codeEditor.undo();
    }
  }

  export function redo() {
    if (codeEditor) {
      codeEditor.redo();
    }
  }

  export function selectAll() {
    if (codeEditor) {
      codeEditor.selectAll();
    }
  }

  export function openSearch() {
    if (codeEditor) {
      codeEditor.openSearch();
    }
  }

  export function toggleLineComment() {
    if (codeEditor) {
      codeEditor.toggleLinePrefix("// ");
    }
  }

  export function toggleBlockComment() {
    if (codeEditor) {
      codeEditor.toggleWrap("/* ", " */");
    }
  }

  export function canUndo(): boolean {
    return codeEditor ? codeEditor.canUndo() : false;
  }

  export function canRedo(): boolean {
    return codeEditor ? codeEditor.canRedo() : false;
  }

  // Expose the underlying CodeMirror EditorView to parent components
  export function getEditorView() {
    try {
      return codeEditor?.getView?.() ?? null;
    } catch (e) {
      return null;
    }
  }

  // Navigate to a specific line and column in the editor
  export function navigateToDiagnostic(
    line: number,
    character: number,
    endLine?: number,
    endCharacter?: number,
  ) {
    try {
      const view = codeEditor?.getView?.();
      if (!view) return;

      const doc = view.state.doc;
      // Convert 1-based to 0-based line numbering
      const startLineNum = Math.max(1, line);
      const endLineNum = endLine ? Math.max(1, endLine) : startLineNum;

      if (startLineNum <= doc.lines && endLineNum <= doc.lines) {
        const startLineObj = doc.line(startLineNum);
        const endLineObj = doc.line(endLineNum);

        const from = startLineObj.from + Math.max(0, character);
        const to = endLineObj.from + Math.max(0, endCharacter ?? character);

        // Dispatch transaction to set selection and scroll into view
        view.dispatch({
          selection: { anchor: from, head: to },
          scrollIntoView: true,
        });
        view.focus();
      }
    } catch (e) {
      console.error("Failed to navigate to diagnostic:", e);
    }
  }

  // Update comments whenever the version changes or file changes
  $effect(() => {
    if (codeEditor && selectedFile && commentsVersion >= 0) {
      updateCommentsFromTracker();
    }
  });

  // Notify parent when comments change
  $effect(() => {
    onCommentsChange?.(comments);
  });

  // Notify parent when draft changes
  $effect(() => {
    onNewCommentDraftChange?.(newCommentDraft);
  });

  // Sync active comment state to the editor's tracker
  $effect(() => {
    const tracker = codeEditor?.getCommentTracker();
    if (tracker) {
      tracker.setActiveComment(activeCommentId ?? null);
    }
  });

  function resolveRangeFromComment(comment: Comment): { from: number; to: number } | null {
    const view = codeEditor?.getView?.();
    if (!view) return null;

    // Preferred path: resolve persisted Yjs relative anchors against current text.
    if (comment.anchorRelJson && comment.headRelJson && ytext?.doc) {
      try {
        const anchor = Y.createRelativePositionFromJSON(JSON.parse(comment.anchorRelJson));
        const head = Y.createRelativePositionFromJSON(JSON.parse(comment.headRelJson));
        const anchorPos = Y.createAbsolutePositionFromRelativePosition(anchor, ytext.doc);
        const headPos = Y.createAbsolutePositionFromRelativePosition(head, ytext.doc);
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

  function syncCommentDecorationsFromAnchors() {
    const view = codeEditor?.getView?.();
    if (!view) return;

    const ranges = new Map<string, { from: number; to: number }>();
    for (const comment of commentsForAnchors) {
      if (comment.resolved) continue;
      const range = resolveRangeFromComment(comment);
      if (!range) continue;
      if (range.to <= range.from) continue;
      ranges.set(comment.id, range);
    }

    view.dispatch({
      effects: updateCommentsEffect.of({ comments: ranges }),
    });
  }

  // Keep highlight ranges in sync from DB comments + Yjs anchor resolution.
  $effect(() => {
    if (!codeEditor || !selectedFile || !commentsForAnchors) return;
    syncCommentDecorationsFromAnchors();
  });

  // Reset listeners flag and hide comment button when file changes
  $effect(() => {
    if (selectedFile) {
      listenersSetup = false;
      showCommentButton = false;
    }
  });

  // Setup selection listeners when editor is ready
  $effect(() => {
    if (codeEditor && !listenersSetup) {
      const view = codeEditor.getView();
      if (view) {
        setupSelectionListener(view);
        listenersSetup = true;
      }
    }
  });

  // If permissions are downgraded, immediately hide any pending comment composer UI.
  $effect(() => {
    if (!canComment) {
      if (newCommentDraft) {
        newCommentDraft = null;
      }
      showCommentButton = false;
    }
  });

  // Scroll the editor to a specific comment's range
  export function scrollToComment(commentId: string) {
    const comment = commentsForAnchors.find((item) => item.id === commentId);
    if (!comment) return;

    const range = resolveRangeFromComment(comment);
    const view = codeEditor?.getView?.();
    if (view && range) {
      view.dispatch({
        selection: { anchor: range.from, head: range.to },
        scrollIntoView: true,
      });
    }
  }

  // Get the pixel y-positions of all comments relative to editor content top
  export function getCommentPositions(): Map<string, number> {
    const positions = new Map<string, number>();
    const view = codeEditor?.getView?.();
    if (!view) return positions;

    const scrollDOM = view.scrollDOM;
    const scrollTop = scrollDOM.scrollTop;
    const editorRect = scrollDOM.getBoundingClientRect();

    for (const comment of commentsForAnchors) {
      const range = resolveRangeFromComment(comment);
      if (!range) continue;
      const coords = view.coordsAtPos(range.from);
      if (!coords) continue;
      const top = coords.top - editorRect.top + scrollTop;
      positions.set(comment.id, top);
    }

    return positions;
  }

  // Get the editor scroll DOM for scroll syncing
  export function getEditorScrollDOM(): HTMLElement | null {
    const tracker = codeEditor?.getCommentTracker();
    if (tracker) {
      return tracker.getScrollDOM();
    }
    return null;
  }

  function handleTrackerReady(tracker: any) {
    // Register the tracker for click handling
    setCurrentTracker(tracker);
    // Set up callback for when comments change
    tracker.onCommentsChange(() => {
      commentsVersion++;
    });
    // Set up callback for when a comment highlight is clicked in the editor
    tracker.onCommentClick((commentId: string) => {
      onCommentClick?.(commentId);
    });
    // Set up callback for when a comment highlight is hovered in the editor
    tracker.onCommentHover((commentId: string | null) => {
      onCommentHover?.(commentId);
    });
    // Set up callback for when the document content changes
    tracker.onDocChange(() => {
      onDocChange?.();
    });
    // Trigger initial update
    commentsVersion++;
  }

  function setupSelectionListener(view: any) {
    const editorDom = view.dom;

    const handleSelectionChange = () => {
      setTimeout(() => {
        const selection = codeEditor?.getSelection();
        if (
          selection &&
          selection.from !== selection.to &&
          selection.text.trim()
        ) {
          // Get the coordinates of the selection
          const coords = view.coordsAtPos(selection.to);
          if (coords && editorContainer) {
            const containerRect = editorContainer.getBoundingClientRect();
            showCommentButton = true;
            commentButtonPosition = {
              top: coords.top - containerRect.top + 20,
              left: coords.left - containerRect.left,
            };
          }
        } else {
          showCommentButton = false;
        }
      }, 10);
    };

    editorDom.addEventListener("mouseup", handleSelectionChange);
    editorDom.addEventListener("keyup", handleSelectionChange);
  }

  function updateCommentsFromTracker() {
    const tracker = codeEditor?.getCommentTracker();
    if (tracker) {
      comments = tracker.getAllComments();
    } else {
      comments = [];
    }
  }

  function isImage(mimeType: string) {
    return mimeType.startsWith("image/");
  }

  function isPdf(mimeType: string) {
    return mimeType === "application/pdf";
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    if (diffDays === 0) {
      return `Today at ${timeStr}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${timeStr}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  function getFileExtension(filename: string): string {
    const parts = filename.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "FILE";
  }

  // Build path breadcrumb from parent_id chain
  function buildAssetPath(asset: Asset | null): {
    folders: string[];
    filename: string;
  } {
    if (!asset) return { folders: [], filename: "" };

    const folders: string[] = [];
    let currentParentId = asset.parent_id;

    // Find parent folders by traversing the parent chain
    while (currentParentId !== null) {
      const parentFolder = files.find(
        (f) => f.id === currentParentId && f.is_folder,
      );
      if (parentFolder) {
        folders.unshift(parentFolder.name);
        currentParentId = parentFolder.parent_id;
      } else {
        break;
      }
    }

    return { folders, filename: asset.filename };
  }

  function buildFilePath(file: ProjectFile | null): {
    folders: string[];
    filename: string;
  } {
    if (!file) return { folders: [], filename: "" };

    const folders: string[] = [];
    let currentParentId = file.parent_id;

    // Find parent folders by traversing the parent chain
    while (currentParentId !== null) {
      const parentFolder = files.find(
        (f) => f.id === currentParentId && f.is_folder,
      );
      if (parentFolder) {
        folders.unshift(parentFolder.name);
        currentParentId = parentFolder.parent_id;
      } else {
        break;
      }
    }

    return { folders, filename: file.name };
  }

  // Reactive path computation
  let currentPath = $derived(
    selectedAsset
      ? buildAssetPath(selectedAsset)
      : selectedFile
        ? buildFilePath(selectedFile)
        : { folders: [], filename: "" },
  );

  // Track image dimensions
  let imageDimensions = $state<{ width: number; height: number } | null>(null);

  function handleImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    imageDimensions = {
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  }

  // Reset dimensions when asset changes
  let lastAssetId = $state<string | null>(null);
  $effect(() => {
    if (selectedAsset && selectedAsset.id !== lastAssetId) {
      imageDimensions = null;
      lastAssetId = selectedAsset.id;
    } else if (!selectedAsset) {
      lastAssetId = null;
    }
  });

  export function handleAddComment() {
    if (!canComment) return;
    if (!codeEditor) return;

    const selection = codeEditor.getSelection();
    if (!selection || selection.from === selection.to) {
      return;
    }

    // Create a draft comment and open it in the panel
    newCommentDraft = {
      text: "",
      range: { from: selection.from, to: selection.to },
      selectedText: selection.text,
    };

    // Hide the button
    showCommentButton = false;
  }

  function getCommentContextFromSelection(from: number, to: number) {
    const view = codeEditor?.getView();
    if (!view) {
      return {
        anchorRelJson: null,
        headRelJson: null,
      };
    }

    let anchorRelJson: string | null = null;
    let headRelJson: string | null = null;
    if (ytext) {
      try {
        const anchor = Y.createRelativePositionFromTypeIndex(ytext, from);
        const head = Y.createRelativePositionFromTypeIndex(ytext, to);
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

  export async function handleSubmitNewComment(content: string) {
    if (!canComment) return;
    if (!codeEditor || !newCommentDraft || !selectedFile) return;

    if (onCreateComment) {
      const context = getCommentContextFromSelection(
        newCommentDraft.range.from,
        newCommentDraft.range.to,
      );

      try {
        await onCreateComment({
          file_id: selectedFile.id,
          content,
          anchor_rel_json: context.anchorRelJson,
          head_rel_json: context.headRelJson,
        });
      } catch (error) {
        console.error("Failed to create comment:", error);
        return;
      }

      newCommentDraft = null;
      return;
    }

    if (!ydoc) return;

    const tracker = codeEditor.getCommentTracker();
    if (!tracker) return;

    const view = codeEditor.getView();
    if (!view) return;

    const line = view.state.doc.lineAt(newCommentDraft.range.from).number;

    const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const comment: Comment = {
      id: commentId,
      fileId: selectedFile.id,
      content: content,
      authorId: currentUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolved: false,
      replies: [],
      line: line,
    };

    tracker.addComment(
      commentId,
      newCommentDraft.range.from,
      newCommentDraft.range.to,
      comment,
    );

    // Clear the draft
    newCommentDraft = null;
  }

  export function handleCancelNewComment() {
    newCommentDraft = null;
  }

  export async function handleCommentResolve(commentId: string) {
    if (!canComment) return;

    if (onResolveComment) {
      try {
        await onResolveComment(commentId);
      } catch (error) {
        console.error("Failed to resolve comment:", error);
      }
      return;
    }

    if (!codeEditor) return;

    const tracker = codeEditor.getCommentTracker();
    if (!tracker) return;

    tracker.resolveComment(commentId);
  }

  export async function handleCommentDelete(commentId: string) {
    if (!canModerateComments) return;

    if (onDeleteComment) {
      try {
        await onDeleteComment(commentId);
      } catch (error) {
        console.error("Failed to delete comment:", error);
      }
      return;
    }

    if (!codeEditor) return;

    const tracker = codeEditor.getCommentTracker();
    if (!tracker) return;

    tracker.removeComment(commentId);
  }

  export async function handleCommentReply(commentId: string, content: string) {
    if (!canComment) return;

    if (onReplyComment) {
      try {
        await onReplyComment(commentId, content);
      } catch (error) {
        console.error("Failed to reply to comment:", error);
      }
      return;
    }

    if (!codeEditor) return;

    const tracker = codeEditor.getCommentTracker();
    if (!tracker) return;

    const replyId = `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const reply = {
      id: replyId,
      content,
      authorId: currentUserId,
      createdAt: new Date().toISOString(),
    };

    tracker.addReply(commentId, reply);
  }

  // Action button handlers for typst files
  function handleBold() {
    if (codeEditor) {
      codeEditor.toggleWrap("*", "*");
    }
  }

  function handleItalic() {
    if (codeEditor) {
      codeEditor.toggleWrap("_", "_");
    }
  }

  function handleUnderline() {
    if (codeEditor) {
      codeEditor.toggleWrap("#underline[", "]");
    }
  }

  function handleList() {
    if (codeEditor) {
      codeEditor.toggleLinePrefix("- ", "+ ");
    }
  }

  function handleNumberedList() {
    if (codeEditor) {
      codeEditor.toggleLinePrefix("+ ", "- ");
    }
  }

  function handleEquation() {
    if (codeEditor) {
      codeEditor.toggleWrap("$", "$");
    }
  }

  function handleCodeBlock() {
    if (codeEditor) {
      codeEditor.toggleWrap("`", "`");
    }
  }

  function handleScrollPreview() {
    console.log("Scroll preview");
    // TODO: Implement scroll preview
  }

  // Action button handlers for non-typst files
  async function handleDownloadFile() {
    if (selectedAsset && onGetAssetUrl) {
      try {
        const url = await onGetAssetUrl(selectedAsset.id);
        window.open(url, "_blank");
      } catch (error: any) {
        console.error("Failed to download asset:", error);
        const message = error?.message || "Failed to download file";
        console.warn("Download failed:", message);
      }
    } else if (selectedFile) {
      try {
        const view = codeEditor?.getView?.();
        if (view) {
          const content = view.state.doc.toString();
          const blob = new Blob([content], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = selectedFile.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error("Failed to download file:", error);
      }
    }
  }

  function handleUploadFile() {
    // Dispatch event to parent to show upload modal
    window.dispatchEvent(new CustomEvent("toolbar-upload"));
  }

  function handleRenameFile() {
    // Trigger rename in FileTree for currently selected file/asset
    window.dispatchEvent(new CustomEvent("trigger-file-rename"));
  }

  function handleDeleteFile() {
    // Dispatch event to parent to handle delete via confirmation modal
    window.dispatchEvent(new CustomEvent("toolbar-delete-file"));
  }

  // Check if file type is text-editable
  type fileType = "asset" | "text" | "typst";
  let fileExtension = $derived(getFileExtension(fileName));
  let currentFileType = $derived<fileType>(
    selectedAsset ? "asset" : selectedFile ? (fileExtension === "TYP" ? "typst" : "text") : "text",
  );

  // Define all toolbar buttons with their metadata
  type ToolbarButton = {
    id: string;
    label: string;
    icon: Component;
    onclick: () => void;
    position?: "first" | "middle" | "last" | "standalone";
    strokeWidth?: number;
    shortcut?: string;
  };

  const typstToolbarButtons: ToolbarButton[][] = [
    [
      {
        id: "bold",
        label: "Bold",
        icon: Bold,
        onclick: handleBold,
        position: "first",
        strokeWidth: 3,
        shortcut: "Ctrl+B",
      },
      {
        id: "italic",
        label: "Italic",
        icon: Italic,
        onclick: handleItalic,
        position: "middle",
        shortcut: "Ctrl+I",
      },
      {
        id: "underline",
        label: "Underline",
        icon: Underline,
        onclick: handleUnderline,
        position: "last",
        shortcut: "Ctrl+U",
      },
    ],
    [
      {
        id: "list",
        label: "List",
        icon: List,
        onclick: handleList,
        position: "first",
      },
      {
        id: "numberedList",
        label: "Numbered list",
        icon: ListOrdered,
        onclick: handleNumberedList,
        position: "middle",
      },
      {
        id: "equation",
        label: "Equation",
        icon: Sigma,
        onclick: handleEquation,
        position: "middle",
      },
      {
        id: "codeBlock",
        label: "Code block",
        icon: Code,
        onclick: handleCodeBlock,
        position: "last",
      },
    ],
    [
      {
        id: "addComment",
        label: "Add comment",
        icon: MessageSquarePlus,
        onclick: handleAddComment,
        position: "standalone",
      },
    ],
  ];

  // Right-side buttons (scroll preview, close separate preview)
  let rightButtons = $derived.by(() => {
    const buttons: ToolbarButton[] = [];

    if (separateWindow) {
      buttons.push({
        id: "closeSeparatePreview",
        label: "Close separate preview",
        icon: Columns2,
        onclick: closeSeparatePreview,
        position: "middle",
      });
    }

    if (currentFileType === "typst") {
      buttons.push({
        id: "scrollPreview",
        label: "Scroll preview to cursor",
        icon: Redo,
        onclick: handleScrollPreview,
        position: "middle",
      });
    }

    return buttons;
  });

  const assetToolbarButtons: ToolbarButton[][] = [
    [
      {
        id: "download",
        label: "Download",
        icon: ArrowDownToLine,
        onclick: handleDownloadFile,
        position: "first",
      },
      {
        id: "upload",
        label: "Upload",
        icon: ArrowUpFromLine,
        onclick: handleUploadFile,
        position: "middle",
      },
      {
        id: "rename",
        label: "Rename",
        icon: PencilLine,
        onclick: handleRenameFile,
        position: "middle",
      },
      {
        id: "delete",
        label: "Delete",
        icon: Trash2,
        onclick: handleDeleteFile,
        position: "last",
      },
    ],
  ];

  const nonTypstWithCommentButtons: ToolbarButton[][] = [
    [
      {
        id: "download",
        label: "Download",
        icon: ArrowDownToLine,
        onclick: handleDownloadFile,
        position: "first",
      },
      {
        id: "upload",
        label: "Upload",
        icon: ArrowUpFromLine,
        onclick: handleUploadFile,
        position: "middle",
      },
      {
        id: "rename",
        label: "Rename",
        icon: PencilLine,
        onclick: handleRenameFile,
        position: "middle",
      },
      {
        id: "delete",
        label: "Delete",
        icon: Trash2,
        onclick: handleDeleteFile,
        position: "last",
      },
    ],
    [
      {
        id: "addComment",
        label: "Add comment",
        icon: MessageSquarePlus,
        onclick: handleAddComment,
        position: "standalone",
      },
    ],
  ];

  // Get current toolbar buttons based on file type
  let currentToolbarButtons = $derived<ToolbarButton[][]>(
    currentFileType === "asset"
      ? assetToolbarButtons
      : currentFileType === "typst"
        ? typstToolbarButtons
        : nonTypstWithCommentButtons,
  );

  // Flattened list of all buttons (left + right) with group info
  interface FlatButton extends ToolbarButton {
    section: "left" | "right";
    groupIndex: number;
    buttonIndex: number;
    originalPosition: "first" | "middle" | "last" | "standalone";
  }

  let flatButtons = $derived.by(() => {
    const leftButtons = currentToolbarButtons
      .flatMap((group, groupIndex) =>
        group.map((button, buttonIndex) => ({
          ...button,
          section: "left" as const,
          groupIndex,
          buttonIndex,
          originalPosition: button.position || "standalone",
        })),
      )
      .filter((button) => {
        const isWriteButton = ["bold", "italic", "underline", "list", "numberedList", "equation", "codeBlock", "upload", "rename", "delete"].includes(button.id);
        const isCommentButton = button.id === "addComment";
        if (isWriteButton && !canWrite) return false;
        if (isCommentButton && !canComment) return false;
        return true;
      })

    const rightButtonsFlat = rightButtons.map((button, buttonIndex) => ({
        ...button,
        section: "right" as const,
        groupIndex: currentToolbarButtons.length,
        buttonIndex,
        originalPosition: button.position || "standalone",
    }));

    return [...leftButtons, ...rightButtonsFlat];
  });

  // Track which buttons are visible (by index in flatButtons)
  let visibleButtonIndices = $state<number[]>([]);

  // Computed visible buttons for the toolbar with adjusted positions
  let visibleLeftButtons = $derived.by(() => {
    const leftButtons = flatButtons.filter(
      (btn, index) =>
        btn.section === "left" && visibleButtonIndices.includes(index),
    );

    // Adjust positions based on visibility
    return leftButtons.map((btn, index, arr) => {
      const prevBtn = index > 0 ? arr[index - 1] : null;
      const nextBtn = index < arr.length - 1 ? arr[index + 1] : null;

      const isStartOfGroup = !prevBtn || prevBtn.groupIndex !== btn.groupIndex;
      const isEndOfGroup = !nextBtn || nextBtn.groupIndex !== btn.groupIndex;

      let position: "first" | "middle" | "last" | "standalone";
      if (btn.originalPosition === "standalone") {
        position = "standalone";
      } else if (isStartOfGroup && isEndOfGroup) {
        position = "standalone";
      } else if (isStartOfGroup) {
        position = "first";
      } else if (isEndOfGroup) {
        position = "last";
      } else {
        position = "middle";
      }

      return { ...btn, position };
    });
  });

  // Computed visible right buttons for the toolbar
  let visibleRightButtons = $derived.by(() => {
    const rightBtns = flatButtons.filter(
      (btn, index) =>
        btn.section === "right" && visibleButtonIndices.includes(index),
    );

    // Adjust positions based on visibility
    return rightBtns.map((btn, index, arr) => {
      const prevBtn = index > 0 ? arr[index - 1] : null;
      const nextBtn = index < arr.length - 1 ? arr[index + 1] : null;

      const isStartOfGroup = !prevBtn || prevBtn.groupIndex !== btn.groupIndex;
      const isEndOfGroup = !nextBtn || nextBtn.groupIndex !== btn.groupIndex;

      let position: "first" | "middle" | "last" | "standalone";
      if (btn.originalPosition === "standalone") {
        position = "standalone";
      } else if (isStartOfGroup && isEndOfGroup) {
        position = "standalone";
      } else if (isStartOfGroup) {
        position = "first";
      } else if (isEndOfGroup) {
        position = "last";
      } else {
        position = "middle";
      }

      return { ...btn, position };
    });
  });

  // Detect toolbar overflow and move buttons to More dropdown
  let resizeTimeoutId: number | null = null;
  let measuredButtonWidth: number | null = null;
  let measuredMoreButtonWidth: number | null = null;
  let measuredGapWidth: number | null = null;

  function checkToolbarOverflow() {
    if (!toolbarElement || !showToolbar) return;

    // Measure actual button widths on first run
    if (
      measuredButtonWidth === null ||
      measuredMoreButtonWidth === null ||
      measuredGapWidth === null
    ) {
      const toolButton = toolbarElement.querySelector(".tool-group button");
      const moreButton = toolbarElement.querySelector(".more-button button");
      const toolGroups = toolbarElement.querySelectorAll(
        ".toolbar-left > .tool-group",
      );

      if (toolButton) {
        const rect = toolButton.getBoundingClientRect();
        measuredButtonWidth = rect.width;
      }

      if (moreButton) {
        const rect = moreButton.getBoundingClientRect();
        measuredMoreButtonWidth = rect.width;
      }

      // Measure gap by checking distance between two tool groups
      if (toolGroups.length >= 2) {
        const firstGroup = toolGroups[0].getBoundingClientRect();
        const secondGroup = toolGroups[1].getBoundingClientRect();
        measuredGapWidth = secondGroup.left - firstGroup.right;
      }

      // If we couldn't measure, use fallback values and try again later
      if (
        !measuredButtonWidth ||
        !measuredMoreButtonWidth ||
        !measuredGapWidth
      ) {
        measuredButtonWidth = 38;
        measuredMoreButtonWidth = 40;
        measuredGapWidth = 8;
      }
    }

    const toolbarWidth = toolbarElement.clientWidth;
    const moreButtonWidth = measuredMoreButtonWidth || 40;
    const buttonWidth = measuredButtonWidth || 38;
    const gapWidth = measuredGapWidth || 8;

    // Calculate how many buttons we can fit
    const totalButtons = flatButtons.length;

    // Calculate available space
    const availableWidth = toolbarWidth - moreButtonWidth - gapWidth - 10; // 10px safety margin

    // Estimate total width needed for all buttons
    let estimatedWidth = 0;
    let lastGroupIndex = -1;

    for (let i = 0; i < totalButtons; i++) {
      const btn = flatButtons[i];
      if (btn.groupIndex !== lastGroupIndex && i > 0) {
        estimatedWidth += gapWidth; // Add gap between groups
      }
      estimatedWidth += buttonWidth;
      lastGroupIndex = btn.groupIndex;
    }

    // If everything fits, show all buttons
    if (estimatedWidth <= availableWidth) {
      visibleButtonIndices = Array.from({ length: totalButtons }, (_, i) => i);
      overflowButtons = [];
      return;
    }

    // Calculate how many buttons we can fit with the More button
    let visibleCount = 0;
    let currentWidth = moreButtonWidth + gapWidth;
    lastGroupIndex = -1;

    for (let i = 0; i < totalButtons; i++) {
      const btn = flatButtons[i];
      const groupGap =
        btn.groupIndex !== lastGroupIndex && i > 0 ? gapWidth : 0;
      const buttonSpace = buttonWidth + groupGap;

      if (currentWidth + buttonSpace <= availableWidth) {
        currentWidth += buttonSpace;
        visibleCount = i + 1;
        lastGroupIndex = btn.groupIndex;
      } else {
        break;
      }
    }

    // Build list of visible button indices
    const newVisibleIndices: number[] = [];
    for (let i = 0; i < visibleCount; i++) {
      newVisibleIndices.push(i);
    }

    visibleButtonIndices = newVisibleIndices;

    // Build overflow menu items (hidden buttons)
    const newOverflow: Array<{
      label: string;
      icon?: Component;
      onclick: () => void;
    }> = [];

    for (let i = visibleCount; i < totalButtons; i++) {
      const btn = flatButtons[i];
      newOverflow.push({
        label: btn.label,
        icon: btn.icon,
        onclick: btn.onclick,
      });
    }

    overflowButtons = newOverflow;
  }

  // Set up ResizeObserver for toolbar with debouncing
  $effect(() => {
    if (toolbarElement && showToolbar) {
      const resizeObserver = new ResizeObserver(() => {
        // Debounce the overflow check to prevent flickering
        if (resizeTimeoutId !== null) {
          clearTimeout(resizeTimeoutId);
        }

        resizeTimeoutId = window.setTimeout(() => {
          checkToolbarOverflow();
          resizeTimeoutId = null;
        }, 50); // 50ms debounce
      });

      resizeObserver.observe(toolbarElement);
      checkToolbarOverflow(); // Initial check

      return () => {
        resizeObserver.disconnect();
        if (resizeTimeoutId !== null) {
          clearTimeout(resizeTimeoutId);
        }
      };
    }
  });
</script>

<div class="editor-pane">
  <!-- Action Toolbar - Dynamic with overflow detection -->
  {#if (selectedAsset || selectedFile) && showToolbar}
    <div
      class="action-toolbar"
      class:has-more={overflowButtons.length > 0}
      bind:this={toolbarElement}
    >
      <div class="toolbar-left">
        {#each Object.entries(visibleLeftButtons.reduce((groups: Record<number, (FlatButton & { position: "first" | "middle" | "last" | "standalone" })[]>, button: FlatButton & { position: "first" | "middle" | "last" | "standalone" }) => {
              const key = button.groupIndex;
              if (!groups[key]) groups[key] = [];
              groups[key].push(button);
              return groups;
            }, {} as Record<number, (FlatButton & { position: "first" | "middle" | "last" | "standalone" })[]>)) as [groupIndex, groupButtons]}
          <div class="tool-group">
            {#each groupButtons as button (button.id)}
              <Tooltip
                text={button.label}
                position="bottom"
                shortcut={button.shortcut}
              >
                <ToolButton
                  icon={button.icon}
                  onclick={button.onclick}
                  position={button.position}
                  strokeWidth={button.strokeWidth}
                />
              </Tooltip>
            {/each}
          </div>
        {/each}
      </div>

      <div class="toolbar-right">
        {#each Object.entries(visibleRightButtons.reduce((groups: Record<number, (FlatButton & { position: "first" | "middle" | "last" | "standalone" })[]>, button: FlatButton & { position: "first" | "middle" | "last" | "standalone" }) => {
              const key = button.groupIndex;
              if (!groups[key]) groups[key] = [];
              groups[key].push(button);
              return groups;
            }, {} as Record<number, (FlatButton & { position: "first" | "middle" | "last" | "standalone" })[]>)) as [groupIndex, groupButtons]}
          <div class="tool-group">
            {#each groupButtons as button (button.id)}
              <Tooltip
                text={button.label}
                position="bottom"
                shortcut={button.shortcut}
              >
                <ToolButton
                  icon={button.icon}
                  onclick={button.onclick}
                  position={button.position}
                  strokeWidth={button.strokeWidth}
                />
              </Tooltip>
            {/each}
          </div>
        {/each}

        {#if overflowButtons.length > 0}
          <div class="more-button">
            <Tooltip text="More options" position="bottom">
              <DropdownToolButton
                icon={MoreHorizontal}
                items={overflowButtons}
                position="standalone"
                buttonWidth="32px"
                allowIconOverflow={false}
              />
            </Tooltip>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- CodeEditor is the foundation - always mounted when we have connection -->
  {#if ytext && provider && ydoc && selectedFile}
    <div class="editor-wrapper" class:hidden={selectedAsset}>
      <div class="editor-container" bind:this={editorContainer}>
        <div class="editor-content">
          {#key `${selectedFile.id}:${canWrite}:${ydoc?.guid ?? "no-doc"}`}
            <CodeEditor
              bind:this={codeEditor}
              {ytext}
              {provider}
              {ydoc}
              fileId={selectedFile.id}
              onTrackerReady={handleTrackerReady}
              {diagnostics}
              {fileName}
              {wrapLines}
              editable={canWrite}
            />
          {/key}

          {#if showCommentButton && canComment}
            <div
              class="floating-comment-wrapper"
              style="position: absolute; top: {commentButtonPosition.top}px; left: {commentButtonPosition.left}px;"
            >
              <Tooltip text="Add comment to selection">
                <IconButton
                  icon={MessageSquarePlus}
                  variant="primary"
                  class="floating-comment-btn"
                  onclick={handleAddComment}
                />
              </Tooltip>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if selectedAsset}
    <div class="asset-preview">
      <div class="preview-content">
        <div class="asset-display">
          {#if onGetAssetBlob}
            {#if safeBlobUrl}
              {#if isImage(selectedAsset.mime_type)}
                <img
                  src={safeBlobUrl}
                  alt={selectedAsset.filename}
                  onload={handleImageLoad}
                />
              {:else if isPdf(selectedAsset.mime_type)}
                <iframe src={safeBlobUrl} title={selectedAsset.filename}
                ></iframe>
              {:else}
                <div class="no-preview">
                  <p>No preview available for this file type</p>
                  <a
                    href={safeBlobUrl}
                    download={selectedAsset.filename}
                    class="download-link"
                  >
                    Download {selectedAsset.filename}
                  </a>
                </div>
              {/if}
            {:else}
              <div class="loading-preview">
                <p>Loading preview...</p>
              </div>
            {/if}
          {:else if onGetAssetUrl}
            {#await onGetAssetUrl(selectedAsset.id)}
              <div class="loading-preview">
                <p>Loading preview...</p>
              </div>
            {:then assetUrl}
              {#if isImage(selectedAsset.mime_type)}
                <img
                  src={assetUrl}
                  alt={selectedAsset.filename}
                  onload={handleImageLoad}
                />
              {:else if isPdf(selectedAsset.mime_type)}
                <iframe src={assetUrl} title={selectedAsset.filename}></iframe>
              {:else}
                <div class="no-preview">
                  <p>No preview available for this file type</p>
                  <a
                    href={assetUrl}
                    download={selectedAsset.filename}
                    class="download-link"
                  >
                    Download {selectedAsset.filename}
                  </a>
                </div>
              {/if}
            {:catch}
              <div class="no-preview">
                <p>Failed to load preview</p>
              </div>
            {/await}
          {:else}
            <div class="no-preview">
              <p>No preview handler available</p>
            </div>
          {/if}
        </div>

        <AssetMetadata asset={selectedAsset} {imageDimensions} />
      </div>
    </div>
  {/if}

  {#if !selectedFile && !selectedAsset}
    <div class="no-selection">
      <p>{!isConnected ? "Connecting..." : "Select a file to start editing"}</p>
    </div>
  {/if}
</div>

<style>
  .editor-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .editor-wrapper,
  .asset-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: auto;
  }

  .editor-wrapper {
    border-top-left-radius: var(--radius-lg);
    border-top-right-radius: var(--radius-lg);
  }

  .asset-preview {
    border-top-left-radius: var(--radius-lg);
  }

  .editor-wrapper.hidden {
    display: none;
  }

  .action-toolbar {
    background: var(--bg-top-bar);
    padding: 0 0 var(--space-2) 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    overflow: visible;
  }

  .action-toolbar.has-more {
    padding-right: 0;
  }

  .toolbar-left {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .toolbar-right {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-left: auto;
  }

  .tool-group {
    display: flex;
    align-items: center;
  }

  .more-button {
    display: flex;
    align-items: center;
  }

  .editor-container {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .editor-content {
    flex: 1;
    overflow: auto;
    position: relative;
  }

  :global(.floating-comment-btn) {
    z-index: 100;
    box-shadow: var(--shadow-lg);
    animation: fadeIn var(--transition-fast);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .preview-content {
    flex: 1;
    overflow: auto;
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8) var(--space-12);
    gap: var(--space-6);
  }

  .preview-content > :first-child {
    margin-top: max(-10vh, calc(-1 * (100vh - var(--space-8) * 2 - var(--space-6) - 60vh - 8rem) / 2));
  }

  .asset-display {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    flex-shrink: 0;
  }

  .asset-display img {
    max-width: 100%;
    max-height: 60vh;
    object-fit: contain;
    border-radius: 1px;
  }

  .asset-display iframe {
    width: 100%;
    height: 60vh;
    border: none;
    border-radius: 1px;
  }

  .preview-content img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .preview-content iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  .no-preview {
    text-align: center;
    color: var(--text-tertiary);
    padding: var(--space-8);
  }

  .loading-preview {
    text-align: center;
    color: var(--text-tertiary);
    padding: var(--space-8);
    font-size: var(--text-base);
  }

  .download-link {
    color: var(--color-primary-500);
    text-decoration: none;
    display: block;
    margin-top: var(--space-4);
  }

  .download-link:hover {
    color: var(--color-primary-400);
    text-decoration: underline;
  }

  .no-selection {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    font-size: var(--text-lg);
  }
</style>
