<script lang="ts">
  import { mount, onMount, onDestroy, tick } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import {
    projectsApi,
    filesApi,
    assetsApi,
    commentsApi,
  } from "$lib/services/api";
  import {
    createProjectYjs,
    destroyYjsConnection,
    getFileText,
  } from "$lib/yjs";
  import { createProjectSync } from "$lib/projectSync";
  import { createCommentSync } from "$lib/commentSync";
  import { auth } from "$lib/stores/auth";
  import { notifications } from "$lib/stores/notifications";
  import { theme } from "$lib/stores/theme";
  import {
    ThemeToggle,
    ProfileMenu,
    Tooltip,
    MenuBar,
    IconButton,
  } from "$lib/components/ui";
  import Home from "@lucide/svelte/icons/home";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ActivityBar from "$lib/components/editor/ActivityBar.svelte";
  import FileTree from "$lib/components/editor/FileTree.svelte";
  import PlaceholderPanel from "$lib/components/editor/PlaceholderPanel.svelte";
  import SettingsPanel from "$lib/components/editor/SettingsPanel.svelte";
  import EditorPane from "$lib/components/editor/EditorPane.svelte";
  import DeleteConfirmModal from "$lib/components/editor/DeleteConfirmModal.svelte";
  import UploadAssetModal from "$lib/components/editor/UploadAssetModal.svelte";
  import CollaboratorsPanel from "$lib/components/editor/CollaboratorsPanel.svelte";
  import CommentsPanel from "$lib/components/editor/CommentsPanel.svelte";
  import UserPresence from "$lib/components/editor/UserPresence.svelte";
  import type {
    Project,
    File as ProjectFile,
    Asset,
    Comment,
    Diagnostic,
    CommentThreadDTO,
    CommentReplyDTO,
  } from "$lib/types";
  import type { YjsConnection } from "$lib/yjs";
  import PreviewPane from "$lib/components/editor/PreviewPane.svelte";
  import {
    convertDiagnosticsToLint,
    parseRange,
  } from "$lib/preview/diagnostics";
  import { setDiagnostics } from "@codemirror/lint";
  import IssuesPanel from "$lib/components/editor/IssuesPanel.svelte";
  import SearchPanel from "$lib/components/editor/SearchPanel.svelte";
  import { saveLayoutState, loadLayoutState } from "$lib/utils/layoutStorage";
  import {
    initAssetCache,
    getCachedAsset,
    cacheAsset,
    removeCachedAsset,
    createBlobUrl,
    revokeBlobUrl,
  } from "$lib/utils/assetCache";
  import SeparatePreview from "$lib/components/editor/SeparatePreview.svelte";
  import ShareDialog from "$lib/components/editor/ShareDialog.svelte";

  let projectId = $derived($page.params.projectId ?? "");
  let homeHref = $derived(
    $auth.user?.user_type === "guest" ? "/login" : "/projects",
  );
  let homeTooltip = $derived(
    $auth.user?.user_type === "guest"
      ? "Back to shared project"
      : "Back to dashboard",
  );

  let project = $state<Project | null>(null);
  let files = $state<ProjectFile[]>([]);
  let assets = $state<Asset[]>([]);
  let loadingFileIds = $state<Set<string>>(new Set());
  let isHydratingFiles = $state(false);
  let selectedFile = $state<ProjectFile | null>(null);
  let selectedAsset = $state<Asset | null>(null);
  let previewFileId = $state<string | null>(null);
  let showUploadAssetModal = $state(false);
  let showDeleteModal = $state(false);
  let deleteTarget = $state<{
    type: "file" | "asset";
    id: string;
    name: string;
    isFolder?: boolean;
  } | null>(null);
  let showCollaborators = false;
  let showShareDialog = $state(false);
  let fileTreeHasFocus = $state(false);
  let isEditingProjectName = $state(false);
  let editingProjectName = $state("");
  let projectNameInput = $state<HTMLInputElement | undefined>();
  let renderSession: any = $state(null);
  const unboundExportAction = () => {};
  let exportAsPDF = $state<() => void>(unboundExportAction);
  let exportAsPNG = $state<() => void>(unboundExportAction);
  let exportAsSVG = $state<() => void>(unboundExportAction);
  let exportSourcesAsZip = $state<() => void>(unboundExportAction);

  // Comment state lifted from EditorPane
  let editorComments = $state<Comment[]>([]);
  let unresolvedCommentsCount = $derived(
    editorComments.filter((comment) => !comment.resolved).length,
  );
  let editorNewCommentDraft = $state<{
    text: string;
    range: { from: number; to: number };
    selectedText: string;
  } | null>(null);
  let activeCommentId = $state<string | null>(null);
  let hoveredCommentId = $state<string | null>(null);

  // Comment position state for Overleaf-style aligned comments
  let commentPositions = $state<Map<string, number>>(new Map());
  let editorScrollTop = $state(0);
  let editorContentHeight = $state(2000);
  let draftPosition = $state<number | null>(null);
  let editorScrollCleanup: (() => void) | null = null;
  let isSyncingFromPanel = false;

  // Update comment positions from the editor
  function updateCommentPositions() {
    if (!editorPane) return;
    const positions = editorPane.getCommentPositions();
    commentPositions = positions;

    // Update draft position
    if (editorNewCommentDraft) {
      const view = editorPane.getEditorView();
      if (view) {
        const scrollDOM = view.scrollDOM;
        const coords = view.coordsAtPos(editorNewCommentDraft.range.from);
        if (coords) {
          draftPosition =
            coords.top -
            scrollDOM.getBoundingClientRect().top +
            scrollDOM.scrollTop;
        }
      }
    } else {
      draftPosition = null;
    }

    // Update content height
    const scrollDOM = editorPane.getEditorScrollDOM();
    if (scrollDOM) {
      editorContentHeight = scrollDOM.scrollHeight;
    }
  }

  // Set up scroll listener and position updates when comments panel is visible
  $effect(() => {
    if (activePanel === "comments" && editorPane) {
      // Initial position update
      updateCommentPositions();

      // Set up scroll listener
      const scrollDOM = editorPane.getEditorScrollDOM();
      if (scrollDOM) {
        const handleScroll = () => {
          if (isSyncingFromPanel) return;
          editorScrollTop = scrollDOM.scrollTop;
          updateCommentPositions();
        };
        scrollDOM.addEventListener("scroll", handleScroll, { passive: true });
        editorScrollTop = scrollDOM.scrollTop;

        editorScrollCleanup = () => {
          scrollDOM.removeEventListener("scroll", handleScroll);
        };
      }

      return () => {
        editorScrollCleanup?.();
        editorScrollCleanup = null;
      };
    }
  });

  // Re-compute positions when comments change
  $effect(() => {
    if (activePanel === "comments" && editorComments) {
      // Use a small delay to let decorations settle
      setTimeout(updateCommentPositions, 50);
    }
  });

  // Re-compute positions when draft changes
  $effect(() => {
    if (activePanel === "comments" && editorNewCommentDraft) {
      setTimeout(updateCommentPositions, 50);
    }
  });

  // Auto-open comments panel when a new draft comment is created
  $effect(() => {
    if (editorNewCommentDraft && activePanel !== "comments") {
      activePanel = "comments";
    }
  });

  // Load toggle states from localStorage with defaults
  let wrapLines = $state(
    browser && localStorage.getItem("editor.wrapLines") !== null
      ? localStorage.getItem("editor.wrapLines") === "true"
      : true,
  );
  let negativePreview = $state(
    browser && localStorage.getItem("editor.negativePreview") !== null
      ? localStorage.getItem("editor.negativePreview") === "true"
      : false,
  );
  let showToolbar = $state(
    browser && localStorage.getItem("editor.showToolbar") !== null
      ? localStorage.getItem("editor.showToolbar") === "true"
      : true,
  );

  // Load layout state from localStorage
  const savedLayout = browser ? loadLayoutState() : null;

  // Panel widths for resizable panels
  let leftPanelWidth = $state(savedLayout?.leftPanelWidth ?? 250); // Default width in pixels
  let editorPanelWidth = 0; // Will be calculated
  let previewPanelWidth = $state(0); // Will be calculated
  const MIN_PANEL_WIDTH = 200; // Minimum width for any panel
  const ACTIVITY_BAR_WIDTH = 56; // Fixed activity bar width

  // Initialize active panel based on saved state
  let activePanel = $state<string | null>(
    savedLayout?.leftPanelVisible ? "files" : null,
  );

  let isResizingLeft = false;
  let isResizingRight = false;
  let activeResizeHandle: HTMLButtonElement | null = null;
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  let editorPane: any = $state(null); // Reference to EditorPane component
  let dragOverlay: HTMLDivElement | undefined = $state();

  function handleActivityClick(activityId: string) {
    // Toggle: if clicking the same panel, close it; otherwise open the new panel
    if (activePanel === activityId) {
      activePanel = null;
    } else {
      activePanel = activityId;
    }
  }

  // Save left panel state when it changes
  $effect(() => {
    if (browser) {
      saveLayoutState({
        leftPanelVisible: activePanel !== null,
        leftPanelWidth: leftPanelWidth,
      });
    }
  });

  function handleLeftResizeStart(e: MouseEvent) {
    if (!activePanel) return;
    isResizingLeft = true;
    activeResizeHandle = e.currentTarget as HTMLButtonElement;
    activeResizeHandle.style.opacity = "1";
    activeResizeHandle.style.color = "var(--primary)";
    resizeStartX = e.clientX;
    resizeStartWidth = leftPanelWidth;
    createDragOverlay();
    e.preventDefault();
  }

  function handleRightResizeStart(e: MouseEvent) {
    isResizingRight = true;
    activeResizeHandle = e.currentTarget as HTMLButtonElement;
    activeResizeHandle.style.opacity = "1";
    activeResizeHandle.style.color = "var(--primary)";
    resizeStartX = e.clientX;
    resizeStartWidth = previewPanelWidth;
    createDragOverlay();
    e.preventDefault();
  }

  function createDragOverlay() {
    if (dragOverlay) return;
    dragOverlay = document.createElement("div");
    dragOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10000;
      cursor: ${isResizingLeft ? "col-resize" : "col-resize"};
    `;
    document.body.appendChild(dragOverlay);
  }

  function removeDragOverlay() {
    if (dragOverlay && dragOverlay.parentNode) {
      dragOverlay.parentNode.removeChild(dragOverlay);
    }
    dragOverlay = undefined;
  }

  function handleMouseMove(e: MouseEvent) {
    if (isResizingLeft) {
      const delta = e.clientX - resizeStartX;
      const newWidth = resizeStartWidth + delta;

      // Calculate available space: total width - activity bar - left panel - preview panel - resize handles - right padding
      const totalWidth = window.innerWidth;
      const usedWidth =
        ACTIVITY_BAR_WIDTH + newWidth + previewPanelWidth + 12 + 12 + 16; // 12px per resize handle + 16px right padding
      const editorWidth = totalWidth - usedWidth;

      // Only allow resize if editor maintains minimum width
      if (editorWidth >= MIN_PANEL_WIDTH) {
        leftPanelWidth = Math.max(MIN_PANEL_WIDTH, newWidth);
      }
    } else if (isResizingRight) {
      const delta = resizeStartX - e.clientX; // Inverted for right panel
      const newWidth = resizeStartWidth + delta;

      // Calculate available space: total width - activity bar - left panel - preview panel - resize handles - right padding
      const totalWidth = window.innerWidth;
      const usedWidth =
        ACTIVITY_BAR_WIDTH + leftPanelWidth + newWidth + 12 + 12 + 16; // 12px per resize handle + 16px right padding
      const editorWidth = totalWidth - usedWidth;

      // Only allow resize if editor maintains minimum width
      if (editorWidth >= MIN_PANEL_WIDTH) {
        previewPanelWidth = Math.max(MIN_PANEL_WIDTH, newWidth);

        // Save editor/preview ratio
        if (browser) {
          const availableWidth =
            totalWidth -
            ACTIVITY_BAR_WIDTH -
            (activePanel ? leftPanelWidth + 12 : 0) -
            24 -
            16;
          const ratio = (availableWidth - previewPanelWidth) / availableWidth;
          saveLayoutState({ editorPreviewRatio: ratio });
        }
      }
    }
  }

  function handleMouseUp() {
    isResizingLeft = false;
    isResizingRight = false;
    if (activeResizeHandle) {
      activeResizeHandle.style.opacity = "";
      activeResizeHandle.style.color = "";
      activeResizeHandle = null;
    }
    removeDragOverlay();
  }

  // Editor action handlers
  function handleUndo() {
    if (editorPane && !selectedAsset) {
      editorPane.undo();
    }
  }

  function handleRedo() {
    if (editorPane && !selectedAsset) {
      editorPane.redo();
    }
  }

  function handleSelectAll() {
    if (editorPane && !selectedAsset) {
      editorPane.selectAll();
    }
  }

  function handleSearchReplace() {
    if (editorPane && !selectedAsset) {
      editorPane.openSearch();
    }
  }

  function handleToggleLineComment() {
    if (editorPane && !selectedAsset) {
      editorPane.toggleLineComment();
    }
  }

  function handleToggleBlockComment() {
    if (editorPane && !selectedAsset) {
      editorPane.toggleBlockComment();
    }
  }

  let isViewingAsset = $derived(!!selectedAsset);
  let currentUserRole = $state<"owner" | "admin" | "writer" | "commentor" | "reader">("reader");
  let canWrite = $derived(
    ["owner", "admin", "writer"].includes(currentUserRole),
  );
  let canComment = $derived(
    canWrite || currentUserRole === "commentor",
  );
  let canManageProject = $derived(
    ["owner", "admin"].includes(currentUserRole),
  );

  let yjsConnection = $state<YjsConnection | null>(null);
  let projectSync: any = null;
  let commentSync: any = null;
  let isConnected = $state(false);
  let isSynced = false;
  let isLocalSynced = false;
  let hasConnectedBefore = false;

  // Watch connection status changes
  $effect(() => {
    if (browser) {
      if (isConnected && hasConnectedBefore) {
        notifications.show("Reconnected. Syncing changes...", "info");
      } else if (!isConnected && hasConnectedBefore) {
        notifications.show(
          "Connection lost. Changes will sync when reconnected.",
          "warning",
        );
      }

      if (isConnected) {
        hasConnectedBefore = true;
      }
    }
  });

  // Save toggle states to localStorage
  $effect(() => {
    if (browser) {
      localStorage.setItem("editor.wrapLines", String(wrapLines));
    }
  });

  $effect(() => {
    if (browser) {
      localStorage.setItem("editor.negativePreview", String(negativePreview));
    }
  });

  $effect(() => {
    if (browser) {
      localStorage.setItem("editor.showToolbar", String(showToolbar));
    }
  });

  async function loadProject(): Promise<boolean> {
    try {
      project = await projectsApi.get(projectId);
      currentUserRole = (project?.current_user_role || "reader") as typeof currentUserRole;
      return true;
    } catch (error) {
      console.error("Failed to load project:", error);
      const status = (error as any)?.response?.status;
      if (status === 404 || status === 403) {
        notifications.show("Project not found", "error", 5000);
        if ($auth.user?.user_type === "guest") {
          goto("/login", { replaceState: true });
        } else {
          goto("/");
        }
      }
      return false;
    }
  }

  async function loadFiles() {
    try {
      const data = await filesApi.list(projectId);

      const nonFolderIds = data
        .filter((file) => !file.is_folder)
        .map((file) => file.id);

      // Render tree quickly with metadata-first files, then hydrate content progressively.
      files = data.map((file) =>
        file.is_folder ? file : { ...file, content: "" },
      );
      loadingFileIds = new Set(nonFolderIds);
      isHydratingFiles = nonFolderIds.length > 0;

      // Let the UI render tree metadata before content hydration begins.
      if (nonFolderIds.length > 0) {
        await tick();
      }

      // If project has no files, create main.typ automatically
      if (data.length === 0 && canWrite) {
        try {
          const mainFile = await filesApi.create(
            projectId,
            "main.typ",
            "",
            null,
          );
          files = [mainFile];
          selectedFile = mainFile;
          loadingFileIds = new Set();
          isHydratingFiles = false;
          // Set it as the preview file
          handleSetPreviewFile(mainFile.id);
          return;
        } catch (error) {
          console.error("Failed to create initial main.typ file:", error);
        }
      }

      if (data.length > 0 && !selectedFile) {
        // Select preview file if set, otherwise select first file
        if (previewFileId) {
          selectedFile = data.find((f) => f.id === previewFileId) || data[0];
        } else {
          selectedFile = data[0];
        }
      }

      if (nonFolderIds.length === 0) {
        isHydratingFiles = false;
        return;
      }

      // Hydrate file content progressively after the tree is visible.
      let hydratedCount = 0;
      for (const hydrated of data) {
        if (hydrated.is_folder) continue;

        files = files.map((file) =>
          file.id === hydrated.id ? { ...file, content: hydrated.content } : file,
        );

        loadingFileIds = new Set(
          [...loadingFileIds].filter((fileId) => fileId !== hydrated.id),
        );

        hydratedCount += 1;
        if (hydratedCount % 20 === 0) {
          await tick();
        }
      }

      isHydratingFiles = false;
    } catch (error) {
      console.error("Failed to load files:", error);
      loadingFileIds = new Set();
      isHydratingFiles = false;
    }
  }

  async function loadAssets() {
    try {
      const data = await assetsApi.list(projectId);
      assets = data;
    } catch (error) {
      console.error("Failed to load assets:", error);
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

  function applyThreadUpdate(thread: CommentThreadDTO) {
    if (thread.status === "deleted") {
      editorComments = editorComments.filter((comment) => comment.id !== thread.id);
      if (activeCommentId === thread.id) {
        activeCommentId = null;
      }
      return;
    }

    if (selectedFile?.id !== thread.file_id) {
      return;
    }

    const mapped = mapThreadToComment(thread);
    const index = editorComments.findIndex((comment) => comment.id === mapped.id);
    if (index === -1) {
      editorComments = [...editorComments, mapped].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return;
    }

    editorComments = editorComments.map((comment) =>
      comment.id === mapped.id ? mapped : comment,
    );
  }

  function applyReplyUpdate(threadId: string, reply: CommentReplyDTO) {
    if (reply.status === "deleted") {
      return;
    }

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
  }

  async function loadCommentsForSelectedFile(file: ProjectFile | null) {
    if (!file || file.is_folder || selectedAsset) {
      editorComments = [];
      return;
    }

    try {
      const threads = await commentsApi.listFileThreads(projectId, file.id);
      if (selectedFile?.id !== file.id) {
        return;
      }

      editorComments = threads
        .filter((thread) => thread.status !== "deleted")
        .map(mapThreadToComment)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } catch (error: any) {
      console.error("Failed to load comments:", error);
      const message = error?.response?.data?.detail || "Failed to load comments";
      notifications.show(message, "error", 4000);
    }
  }

  async function handleCreateComment(payload: {
    file_id: string;
    content: string;
    anchor_rel_json: string | null;
    head_rel_json: string | null;
  }) {
    if (!canComment) return;

    const thread = await commentsApi.createThread(projectId, {
      file_id: payload.file_id,
      content: payload.content,
      anchor_rel_json: payload.anchor_rel_json,
      head_rel_json: payload.head_rel_json,
    });

    applyThreadUpdate(thread);
    activeCommentId = thread.id;
  }

  async function handleResolveComment(commentId: string) {
    if (!canComment) return;

    const thread = await commentsApi.updateThread(projectId, commentId, {
      status: "resolved",
    });
    applyThreadUpdate(thread);
  }

  async function handleReopenComment(commentId: string) {
    if (!canComment) return;

    const thread = await commentsApi.updateThread(projectId, commentId, {
      status: "open",
    });
    applyThreadUpdate(thread);
  }

  async function handleDeleteComment(commentId: string) {
    if (!canManageProject) return;

    const thread = await commentsApi.updateThread(projectId, commentId, {
      status: "deleted",
    });
    applyThreadUpdate(thread);
  }

  async function handleReplyComment(commentId: string, content: string) {
    if (!canComment) return;

    const reply = await commentsApi.createReply(projectId, commentId, {
      content,
    });
    applyReplyUpdate(commentId, reply);
  }

  async function handleCreateFile(fileName: string, parentId: string | null) {
    if (!canWrite) return;

    try {
      const newFile = await filesApi.create(
        projectId,
        fileName,
        "",
        parentId,
      );
      if (!files.find((f) => f.id === newFile.id)) {
        files = [...files, newFile];
      }
      selectedFile = newFile;
      selectedAsset = null;
      if (newFile.name !== fileName) {
        notifications.show(
          `Name already used, created as ${newFile.name}`,
          "info",
        );
      }
    } catch (error: any) {
      console.error("Failed to create file:", error);
      const message = error?.response?.data?.detail || "Failed to create file";
      notifications.show(message, "error", 5000);
      // Re-throw to let FileTree know it failed
      throw error;
    }
  }

  async function handleCreateFolder(
    folderName: string,
    parentId: string | null,
  ) {
    if (!canWrite) return;

    try {
      const newFolder = await filesApi.createFolder(
        projectId,
        folderName,
        parentId,
      );
      if (!files.find((f) => f.id === newFolder.id)) {
        files = [...files, newFolder];
      }
      // Don't select folder to prevent CodeMirror focus
      notifications.show("Folder created successfully", "info");
    } catch (error: any) {
      console.error("Failed to create folder:", error);
      const message =
        error?.response?.data?.detail || "Failed to create folder";
      notifications.show(message, "error", 5000);
      // Re-throw to let FileTree know it failed
      throw error;
    }
  }

  async function handleUploadAsset(filesToUpload: File[]) {
    if (!canWrite) return;
    if (filesToUpload.length === 0) return;

    // Determine parent once per batch: if selected item is a folder, upload inside it.
    const parentId = selectedFile?.is_folder ? selectedFile.id : null;
    let successCount = 0;
    let failedCount = 0;
    const renamedItems: string[] = [];

    for (const file of filesToUpload) {
      try {
        const createdItem = await assetsApi.upload(projectId, file, parentId);

        if ("mime_type" in createdItem) {
          // Cache uploaded binary assets immediately for quick preview.
          const arrayBuffer = await file.arrayBuffer();
          cacheAsset(
            projectId,
            createdItem.id,
            createdItem.storage_path,
            createdItem.mime_type,
            arrayBuffer,
          ).catch((err) => console.warn("Failed to cache uploaded asset:", err));

          if (!assets.find((a) => a.id === createdItem.id)) {
            assets = [...assets, createdItem];
          }
          selectedAsset = createdItem;

          if (createdItem.filename !== file.name) {
            renamedItems.push(`${file.name} -> ${createdItem.filename}`);
          }
        } else {
          if (!files.find((f) => f.id === createdItem.id)) {
            files = [...files, createdItem];
          }
          selectedFile = createdItem;
          selectedAsset = null;

          if (createdItem.name !== file.name) {
            renamedItems.push(`${file.name} -> ${createdItem.name}`);
          }
        }

        successCount += 1;
      } catch (error: any) {
        failedCount += 1;
        console.error("Failed to upload file:", file.name, error);
        const message =
          error?.response?.data?.detail || `Failed to upload ${file.name}`;
        notifications.show(message, "error", 5000);
      }
    }

    if (successCount > 0 && failedCount === 0) {
      notifications.show(`Uploaded ${successCount} file(s)`, "info");
      showUploadAssetModal = false;
    } else if (successCount > 0 && failedCount > 0) {
      notifications.show(
        `Uploaded ${successCount} file(s), ${failedCount} failed`,
        "warning",
        5000,
      );
      // Keep modal open so user can retry failed files.
    } else {
      notifications.show("No files uploaded", "error", 5000);
    }

    if (renamedItems.length > 0) {
      const preview = renamedItems.slice(0, 3).join("; ");
      const suffix =
        renamedItems.length > 3
          ? ` (+${renamedItems.length - 3} more)`
          : "";
      notifications.show(`Auto-renamed: ${preview}${suffix}`, "info", 5000);
    }
  }

  function handleSelectFile(file: ProjectFile) {
    selectedFile = file;
    // If it's a folder, don't clear selectedAsset to prevent editor from loading
    if (!file.is_folder) {
      selectedAsset = null;
    }
    // Reset active comment when switching files
    activeCommentId = null;
    void loadCommentsForSelectedFile(file);
    // Awareness update handled by reactive statement
  }

  function handleSelectAsset(asset: Asset) {
    selectedAsset = asset;
    editorComments = [];
    // Keep selectedFile to prevent CodeEditor from being destroyed
    // Awareness update handled by reactive statement
  }

  function handleClearSelection() {
    selectedFile = null;
    selectedAsset = null;
  }

  function handleSetPreviewFile(fileId: string) {
    previewFileId = fileId;
    if (browser) {
      localStorage.setItem(`preview-file-${projectId}`, String(fileId));
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!canWrite) return;

    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    deleteTarget = {
      type: "file",
      id: fileId,
      name: file.name,
      isFolder: file.is_folder,
    };
    showDeleteModal = true;
  }

  async function handleDeleteAsset(assetId: string) {
    if (!canWrite) return;

    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    deleteTarget = { type: "asset", id: assetId, name: asset.filename };
    showDeleteModal = true;
  }

  async function handleRenameFile(fileId: string, newName: string) {
    if (!canWrite) return;

    try {
      const updatedFile = await filesApi.update(projectId, fileId, {
        name: newName,
      });
      files = files.map((f) => (f.id === fileId ? updatedFile : f));
      if (selectedFile?.id === fileId) {
        selectedFile = updatedFile;
      }
    } catch (error: any) {
      console.error("Failed to rename file:", error);
      const message = error?.response?.data?.detail || "Failed to rename file";
      notifications.show(message, "error", 5000);
      throw error; // Re-throw to let FileTreeItem know it failed
    }
  }

  async function handleRenameAsset(assetId: string, newName: string) {
    if (!canWrite) return;

    try {
      const updatedAsset = await assetsApi.update(projectId, assetId, {
        filename: newName,
      });
      assets = assets.map((a) => (a.id === assetId ? updatedAsset : a));
      if (selectedAsset?.id === assetId) {
        selectedAsset = updatedAsset;
      }
    } catch (error: any) {
      console.error("Failed to rename asset:", error);
      const message = error?.response?.data?.detail || "Failed to rename asset";
      notifications.show(message, "error", 5000);
      throw error; // Re-throw to let FileTreeItem know it failed
    }
  }

  function handleRenameSelectedItem() {
    // Trigger rename in FileTree for currently selected item
    if (selectedAsset || selectedFile) {
      // Dispatch custom event to trigger rename in FileTree
      window.dispatchEvent(new CustomEvent("trigger-file-rename"));
    }
  }

  function handleNewFileFromMenu() {
    if (!canWrite) return;

    // Trigger inline file creation in FileTree
    window.dispatchEvent(new CustomEvent("trigger-new-file"));
  }

  function handleNewFolderFromMenu() {
    if (!canWrite) return;

    // Trigger inline folder creation in FileTree
    window.dispatchEvent(new CustomEvent("trigger-new-folder"));
  }

  function handleDeleteSelectedItem() {
    if (!canWrite) return;

    // Delete currently selected file or asset
    if (selectedAsset) {
      handleDeleteAsset(selectedAsset.id);
    } else if (selectedFile) {
      handleDeleteFile(selectedFile.id);
    }
  }

  // Build path breadcrumb from parent_id chain
  function buildItemPath(item: ProjectFile | Asset | null): {
    folders: string[];
    filename: string;
  } {
    if (!item) return { folders: [], filename: "" };

    const folders: string[] = [];
    let currentParentId = "parent_id" in item ? item.parent_id : null;

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

    const filename = "filename" in item ? item.filename : item.name;
    return { folders, filename };
  }

  // Reactive path computation
  let currentPath = $derived(buildItemPath(selectedAsset || selectedFile));

  async function handleMoveFile(fileId: string, targetFolderId: string | null) {
    if (!canWrite) return;

    try {
      // Check if already in target location
      const fileToMove = files.find((f) => f.id === fileId);
      if (fileToMove && fileToMove.parent_id === targetFolderId) {
        // Already in target location, don't move
        return;
      }

      const updatedFile = await filesApi.move(
        projectId,
        fileId,
        targetFolderId,
      );
      files = files.map((f) => (f.id === fileId ? updatedFile : f));
      if (selectedFile?.id === fileId) {
        selectedFile = updatedFile;
      }
      notifications.show("File moved successfully", "info");
    } catch (error: any) {
      console.error("Failed to move file:", error);
      const message = error?.response?.data?.detail || "Failed to move file";
      notifications.show(message, "error", 5000);
    }
  }

  async function handleMoveAsset(
    assetId: string,
    targetFolderId: string | null,
  ) {
    if (!canWrite) return;

    try {
      // Check if already in target location
      const assetToMove = assets.find((a) => a.id === assetId);
      if (assetToMove && assetToMove.parent_id === targetFolderId) {
        // Already in target location, don't move
        return;
      }

      const updatedAsset = await assetsApi.move(
        projectId,
        assetId,
        targetFolderId,
      );
      assets = assets.map((a) => (a.id === assetId ? updatedAsset : a));
      if (selectedAsset?.id === assetId) {
        selectedAsset = updatedAsset;
      }
      notifications.show("Asset moved successfully", "info");
    } catch (error: any) {
      console.error("Failed to move asset:", error);
      const message = error?.response?.data?.detail || "Failed to move asset";
      notifications.show(message, "error", 5000);
    }
  }

  function handleProjectNameClick() {
    if (!canManageProject) return;
    isEditingProjectName = true;
    editingProjectName = project?.name || "";
    setTimeout(() => {
      projectNameInput?.select();
    }, 0);
  }

  async function handleProjectRenameSubmit() {
    if (!canManageProject) {
      isEditingProjectName = false;
      editingProjectName = "";
      return;
    }

    const trimmedName = editingProjectName.trim();

    if (!project || !trimmedName || trimmedName === project.name) {
      isEditingProjectName = false;
      return;
    }

    try {
      const updatedProject = await projectsApi.update(
        projectId,
        trimmedName,
      );
      project = updatedProject;
      isEditingProjectName = false;
    } catch (error: any) {
      console.error("Failed to rename project:", error);
      const message =
        error?.response?.data?.detail || "Failed to rename project";
      notifications.show(message, "error", 5000);
      // Keep editing mode open on error
    }
  }

  function handleProjectRenameCancel() {
    isEditingProjectName = false;
    editingProjectName = "";
  }

  function handleProjectRenameKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleProjectRenameSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleProjectRenameCancel();
    }
  }

  async function confirmDelete() {
    if (!canWrite) {
      showDeleteModal = false;
      deleteTarget = null;
      return;
    }

    if (!deleteTarget) return;

    const targetId = deleteTarget.id;
    const targetType = deleteTarget.type;
    const targetName = deleteTarget.type === 'file' ? 'file' : 'asset';

    try {
      if (targetType === "file") {
        await filesApi.delete(projectId, targetId);
        files = files.filter((f) => f.id !== targetId);
        if (selectedFile?.id === targetId) {
          // Select first remaining file, or null if none
          selectedFile = files.length > 0 ? files[0] : null;
        }
      } else {
        await assetsApi.delete(projectId, targetId);
        // Remove from cache
        removeCachedAsset(projectId, targetId).catch((err) =>
          console.warn("Failed to remove asset from cache:", err),
        );
        assets = assets.filter((a) => a.id !== targetId);
        if (selectedAsset?.id === targetId) {
          selectedAsset = null;
        }
      }
      // Success: show notification and close modal
      notifications.show(`${targetName} deleted successfully`, "info", 3000);
      showDeleteModal = false;
      deleteTarget = null;
    } catch (error: any) {
      console.error("Failed to delete:", error);
      const message = error?.response?.data?.detail || `Failed to delete ${targetName}`;
      notifications.show(message, "error", 5000);
      // Keep modal open on error so user can retry or cancel
    }
  }

  async function handleGetAssetUrl(assetId: string): Promise<string> {
    const { url } = await assetsApi.getUrl(projectId, assetId);
    return url;
  }

  async function handleGetAssetBlob(asset: Asset): Promise<string> {
    // Try cache first
    const cached = await getCachedAsset(
      projectId,
      asset.id,
      asset.storage_path,
    );
    if (cached) {
      return createBlobUrl(cached.blob, cached.mimeType);
    }

    // Fetch from API and cache
    const { url } = await assetsApi.getUrl(projectId, asset.id);
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    // Cache for future use (fire and forget)
    cacheAsset(
      projectId,
      asset.id,
      asset.storage_path,
      asset.mime_type,
      arrayBuffer,
    ).catch((err) => console.warn("Failed to cache asset:", err));

    return createBlobUrl(arrayBuffer, asset.mime_type);
  }

  function runPreviewExport(exportLabel: string, exportAction: () => void) {
    if (
      typeof exportAction !== "function" ||
      exportAction === unboundExportAction
    ) {
      notifications.show(`${exportLabel} is not available yet`, "warning", 2500);
      return;
    }

    exportAction();
  }

  function handleExportPDF() {
    runPreviewExport("PDF export", exportAsPDF);
  }

  function handleExportPNG() {
    runPreviewExport("PNG export", exportAsPNG);
  }

  function handleExportSVG() {
    runPreviewExport("SVG export", exportAsSVG);
  }

  function onFileCreated(file: ProjectFile) {
    if (!files.find((f) => f.id === file.id)) {
      files = [...files, file];
    }
    if (yjsConnection?.ydoc) {
      const ytext = getFileText(yjsConnection.ydoc, file.id);
      if (ytext && ytext.length === 0 && file.content) {
        ytext.insert(0, file.content);
      }
    }
  }

  function onFileUpdated(file: ProjectFile) {
    files = files.map((f) => (f.id === file.id ? file : f));
    if (selectedFile?.id === file.id) {
      selectedFile = file;
    }
  }

  function onFileDeleted(fileId: string) {
    files = files.filter((f) => f.id !== fileId);
    if (selectedFile?.id === fileId) {
      selectedFile = files[0] || null;
      void loadCommentsForSelectedFile(selectedFile);
    }

    // Clean up Yjs data for the deleted file
    if (yjsConnection?.ydoc) {
      const ytext = yjsConnection.ydoc.getText(`file-${fileId}`);
      if (ytext && ytext.length > 0) {
        ytext.delete(0, ytext.length);
        console.log(`[YJS] Cleared Y.Text for deleted file-${fileId}`);
      }
    }
  }

  function onAssetCreated(asset: Asset) {
    if (!assets.find((a) => a.id === asset.id)) {
      assets = [...assets, asset];
    }
  }

  function onAssetUpdated(asset: Asset) {
    assets = assets.map((a) => (a.id === asset.id ? asset : a));
    if (selectedAsset?.id === asset.id) {
      selectedAsset = asset;
    }
  }

  function onAssetDeleted(assetId: string) {
    // Remove from cache
    removeCachedAsset(projectId, assetId).catch((err) =>
      console.warn("Failed to remove deleted asset from cache:", err),
    );
    assets = assets.filter((a) => a.id !== assetId);
    if (selectedAsset?.id === assetId) {
      selectedAsset = null;
    }
  }

  function onProjectUpdated(updatedProject: Project) {
    if (project && updatedProject.id === project.id) {
      project = { ...project, ...updatedProject };
      if (updatedProject.current_user_role) {
        currentUserRole = updatedProject.current_user_role as typeof currentUserRole;
      }
    }
  }

  let isRefreshingPermissions = false;
  let isResettingRealtime = false;

  function destroyRealtimeConnections() {
    if (yjsConnection) {
      destroyYjsConnection(yjsConnection);
      yjsConnection = null;
    }
    if (projectSync) {
      projectSync.destroy();
      projectSync = null;
    }
    if (commentSync) {
      commentSync.destroy();
      commentSync = null;
    }
  }

  function initRealtimeConnections() {
    yjsConnection = createProjectYjs(
      projectId,
      (status) => {
        isConnected = status.isConnected;
        isSynced = status.isSynced;
        isLocalSynced = status.isLocalSynced;
      },
      $auth.user,
      $auth.token,
    );

    projectSync = createProjectSync(projectId, {
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
    }, $auth.token);

    commentSync = createCommentSync(
      projectId,
      {
        onConnected: ({ reconnected }) => {
          if (reconnected && selectedFile && !selectedFile.is_folder) {
            void loadCommentsForSelectedFile(selectedFile);
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
      $auth.token,
    );
  }

  async function resetRealtimeConnectionsForWriteLoss() {
    if (isResettingRealtime) return;
    isResettingRealtime = true;

    try {
      const selectedFileId = selectedFile?.id ?? null;

      // Drop old Yjs doc/provider state so unsynced edits cannot be replayed later.
      destroyRealtimeConnections();
      initRealtimeConnections();

      // Force file reselection so the rebuilt editor instance reopens the current file.
      if (selectedFileId) {
        const reopenedFile = files.find((file) => file.id === selectedFileId) || null;
        selectedFile = null;
        await tick();
        selectedFile = reopenedFile;

        if (reopenedFile && yjsConnection?.ydoc) {
          const reopenedYtext = getFileText(yjsConnection.ydoc, reopenedFile.id);
          if (reopenedYtext && reopenedYtext.length === 0 && reopenedFile.content) {
            reopenedYtext.insert(0, reopenedFile.content);
          }
        }
      }

      if (selectedFile && !selectedFile.is_folder) {
        await loadCommentsForSelectedFile(selectedFile);
      }
    } finally {
      isResettingRealtime = false;
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

    const hadWrite = canWrite;
    const hadComment = canComment;

    try {
      const nextCanWriteFromRole = (role: string) => ["owner", "admin", "writer"].includes(role);
      const nextCanCommentFromRole = (role: string) => nextCanWriteFromRole(role) || role === "commentor";

      const hasImmediateRoleUpdate = action === "removed_from_project" || !!newRole;

      if (project && action === "removed_from_project") {
        project = { ...project, current_user_role: "reader" };
        currentUserRole = "reader";
      } else if (project && newRole) {
        project = { ...project, current_user_role: newRole };
        currentUserRole = newRole;
      } else if (!project && newRole) {
        currentUserRole = newRole;
      }

      if (!hasImmediateRoleUpdate) {
        const loaded = await loadProject();
        if (!loaded) return;
      } else {
        // Reconcile with backend source of truth without delaying UI lock.
        void loadProject();
      }

      const resolvedRole = currentUserRole;
      const nextCanWrite = nextCanWriteFromRole(resolvedRole);
      const nextCanComment = nextCanCommentFromRole(resolvedRole);

      if (hadWrite && !nextCanWrite) {
        editorNewCommentDraft = null;
        await resetRealtimeConnectionsForWriteLoss();
        notifications.show(
          reason || "Your write access was removed. Editor switched to read-only.",
          "warning",
          5000,
        );
        return;
      }

      if (hadComment && !nextCanComment) {
        editorNewCommentDraft = null;
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

  // Handle toolbar events from EditorPane
  function setupEditorPaneEventListeners() {
    const handleToolbarUpload = () => {
      if (!canWrite) return;
      showUploadAssetModal = true;
    };

    const handleToolbarDeleteFile = () => {
      if (!canWrite) return;
      if (selectedAsset) {
        handleDeleteAsset(selectedAsset.id);
      } else if (selectedFile) {
        handleDeleteFile(selectedFile.id);
      }
    };

    window.addEventListener("toolbar-upload", handleToolbarUpload);
    window.addEventListener("toolbar-delete-file", handleToolbarDeleteFile);

    return () => {
      window.removeEventListener("toolbar-upload", handleToolbarUpload);
      window.removeEventListener("toolbar-delete-file", handleToolbarDeleteFile);
    };
  }

  onMount(() => {
    // Set up toolbar event listeners
    const unlistenToolbarEvents = setupEditorPaneEventListeners();

    // Initialize asset cache and load data asynchronously
    (async () => {
      await initAssetCache();

      // Load preview file from localStorage first
      if (browser) {
        const savedPreviewId = localStorage.getItem(
          `preview-file-${projectId}`,
        );
        if (savedPreviewId) {
          previewFileId = savedPreviewId;
        }

        // Initialize panel widths based on current window size and saved ratio
        const windowWidth = window.innerWidth;
        const availableWidth = windowWidth - ACTIVITY_BAR_WIDTH - 16; // 16px for padding

        if (activePanel) {
          // When left panel is open: split remaining space between editor and preview using saved ratio
          const remainingWidth = availableWidth - leftPanelWidth - 24; // 24px for resize handles
          const savedRatio = savedLayout?.editorPreviewRatio ?? 0.6;
          previewPanelWidth = Math.max(
            MIN_PANEL_WIDTH,
            remainingWidth * (1 - savedRatio),
          );
        } else {
          // When left panel is closed: split between editor and preview using saved ratio
          const savedRatio = savedLayout?.editorPreviewRatio ?? 0.6;
          previewPanelWidth = Math.max(
            MIN_PANEL_WIDTH,
            availableWidth * (1 - savedRatio),
          );
        }
      }

      const loaded = await loadProject();
      if (!loaded) return;

      await Promise.all([loadFiles(), loadAssets()]);

      initRealtimeConnections();

      if (selectedFile && !selectedFile.is_folder) {
        await loadCommentsForSelectedFile(selectedFile);
      }
    })();

    const handleBeforeUnload = () => {
      if (yjsConnection?.provider?.awareness) {
        yjsConnection.provider.awareness.setLocalState(null);
      }
      closeSeparatePreview();
      unlistenToolbarEvents();
    };

    // Handle keyboard shortcuts: Ctrl+S, Ctrl+Shift+S, F2, Delete, Ctrl+/, Ctrl+Shift+A, Ctrl+F
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        !e.altKey &&
        (e.key.toLowerCase() === "s" || e.code === "KeyS")
      ) {
        if (!canWrite) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleExportPDF();
        return false;
      } else if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey &&
        (e.key.toLowerCase() === "s" || e.code === "KeyS")
      ) {
        e.preventDefault();
        notifications.show("All changes are saved automatically", "info", 2000);
      } else if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "f" &&
        !e.shiftKey &&
        !e.altKey
      ) {
        // Ctrl+F for CodeMirror in-file search
        e.preventDefault();
        e.stopPropagation();
        handleSearchReplace();
      } else if (e.key === "F2") {
        if (!canWrite) return;
        e.preventDefault();
        handleRenameSelectedItem();
      } else if (
        e.key === "Delete" &&
        (selectedFile || selectedAsset) &&
        fileTreeHasFocus &&
        !(document.activeElement instanceof HTMLInputElement)
      ) {
        if (!canWrite) return;
        // Only delete file/asset when file tree panel has focus and no input is being edited
        e.preventDefault();
        handleDeleteSelectedItem();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "/" || (e.shiftKey && e.key === ":"))
      ) {
        if (!canWrite) return;
        // Ctrl+/ for line comment (including azerty support where / requires shift)
        e.preventDefault();
        e.stopPropagation();
        handleToggleLineComment();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "A") {
        if (!canWrite) return;
        // Ctrl+Shift+A for block comment
        e.preventDefault();
        e.stopPropagation();
        handleToggleBlockComment();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  });

  onDestroy(() => {
    destroyRealtimeConnections();
  });

  let selectedYtext = $derived(
    selectedFile && yjsConnection?.ydoc
      ? getFileText(yjsConnection.ydoc, selectedFile.id)
      : null,
  );

  // Track file observers for Yjs content changes
  let fileObservers = new Map<string, () => void>();
  let contentVersion = $state(0); // Increment to trigger reactivity

  // Initialize file content and set up observers
  $effect(() => {
    if (browser && yjsConnection?.ydoc && files.length > 0) {
      const ydoc = yjsConnection.ydoc;

      // Clear old observers
      fileObservers.forEach((unobserve) => unobserve());
      fileObservers.clear();

      // Initialize file content and observe changes
      files.forEach((file) => {
        const ytext = getFileText(ydoc, file.id);
        if (ytext) {
          // Initialize if empty
          if (ytext.length === 0 && file.content) {
            ytext.insert(0, file.content);
          }

          // Observe changes to trigger preview updates
          const handler = () => {
            contentVersion++; // Trigger reactivity
          };
          ytext.observe(handler);
          fileObservers.set(file.id, () => ytext.unobserve(handler));
        }
      });
    }
  });

  // Clean up observers
  $effect(() => {
    return () => {
      fileObservers.forEach((unobserve) => unobserve());
      fileObservers.clear();
    };
  });

  // Prioritize asset when both are set (asset is what user is actually viewing)
  let selectedItem = $derived(selectedAsset || selectedFile);

  // Update awareness when selected item changes - prioritize asset when viewing
  $effect(() => {
    if (selectedAsset && yjsConnection?.provider?.awareness) {
      yjsConnection.provider.awareness.setLocalStateField("currentItem", {
        id: selectedAsset.id,
        isAsset: true,
      });
    } else if (selectedFile && yjsConnection?.provider?.awareness) {
      yjsConnection.provider.awareness.setLocalStateField("currentItem", {
        id: selectedFile.id,
        isAsset: false,
      });
    } else if (yjsConnection?.provider?.awareness) {
      yjsConnection.provider.awareness.setLocalStateField("currentItem", null);
    }
  });

  // Ensure awareness user info exists even if auth loads after Yjs connection setup
  $effect(() => {
    const user = $auth.user;
    const awareness = yjsConnection?.provider?.awareness;

    if (!user || !awareness) return;

    const localState = awareness.getLocalState();
    const currentUser = localState?.user;

    if (
      !currentUser ||
      currentUser.id !== user.id ||
      currentUser.name !== user.display_name ||
      currentUser.user_type !== user.user_type
    ) {
      awareness.setLocalStateField("user", {
        id: user.id,
        name: user.display_name,
        user_type: user.user_type,
        color: currentUser?.color || "#3b82f6",
      });
    }
  });

  // Diagnostics state for linter and issues panel
  let diagnostics = $state<Diagnostic[]>([]);

  // Get files with current Yjs content for preview
  let filesWithContent = $derived.by(() => {
    // Track contentVersion to react to Yjs changes
    void contentVersion;

    return files.map((file) => {
      const ytextForFile = yjsConnection?.ydoc
        ? getFileText(yjsConnection.ydoc, file.id)
        : null;

      return {
        ...file,
        content: ytextForFile ? ytextForFile.toString() : file.content,
      };
    });
  });

  // Get preview file path
  let previewFile = $derived(
    previewFileId
      ? filesWithContent.find((f) => f.id === previewFileId)
      : filesWithContent.find((f) => f.name === "main.typ") ||
          filesWithContent.find((f) => f.name.endsWith(".typ")),
  );

  let previewFilePath = $derived(previewFile?.path || "/main.typ");

  // Handle diagnostics from PreviewPane
  function handleDiagnostics(diags: any[]) {
    // Parse diagnostics range from compiler format
    diagnostics = diags.map((d: any) => ({
      severity: d.severity,
      message: d.message,
      range: parseRange(d.range),
      path: d.path,
    }));
    updateLinter();
  }

  function gotoDiagnostic(diagnostic: Diagnostic) {
    if (!diagnostic.range) return;

    // Find the file by path
    const diagnosticFile = files.find((f) => {
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
      selectedFile = diagnosticFile;
      selectedAsset = null;

      // Navigate to the diagnostic in the editor
      setTimeout(() => {
        editorPane?.navigateToDiagnostic?.(
          diagnostic.range!.start.line + 1,
          diagnostic.range!.start.character,
          diagnostic.range!.end.line + 1,
          diagnostic.range!.end.character,
        );
      }, 100);
    }
  }

  function gotoMatch(
    filePath: string,
    startLine: number,
    startChar: number,
    endLine?: number,
    endChar?: number,
  ) {
    // Find the file by path
    const matchFile = files.find((f) => {
      const filePathNormalized = f.path.startsWith("/")
        ? f.path.slice(1)
        : f.path;
      const targetPathNormalized = filePath.startsWith("/")
        ? filePath.slice(1)
        : filePath;
      return filePathNormalized === targetPathNormalized || f.name === filePath;
    });

    if (matchFile) {
      // Select the file
      selectedFile = matchFile;
      selectedAsset = null;

      // Navigate to the match in the editor
      setTimeout(() => {
        editorPane?.navigateToDiagnostic?.(
          startLine + 1,
          startChar,
          endLine ? endLine + 1 : startLine + 1,
          endChar ? endChar : startChar,
        );
      }, 100);
    }
  }

  function updateLinter() {
    const editorView = editorPane?.getEditorView?.();
    if (editorView) {
      const lintDiagnostics = convertDiagnosticsToLint(
        diagnostics,
        editorView,
        selectedFile?.path || "",
      );
      const transaction = setDiagnostics(editorView.state, lintDiagnostics);
      editorView.dispatch(transaction);
    }
  }

  // Preview in separated window
  let separateWindow = $state<Window | null>(null);

  function openSeparatePreview() {
    if (separateWindow && !separateWindow.closed) {
      separateWindow.focus();
      return;
    }

    separateWindow = window.open("", "", "width=900,height=700");
    if (!separateWindow) return;

    // Apply the current theme to the new window
    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "light";
    separateWindow.document.documentElement.setAttribute(
      "data-theme",
      currentTheme,
    );

    // Copy all stylesheets from parent to new window
    const stylesheets = document.querySelectorAll(
      'link[rel="stylesheet"], style',
    );
    stylesheets.forEach((sheet) => {
      const clone = sheet.cloneNode(true);
      separateWindow!.document.head.appendChild(clone);
    });

    // Mount SeparatePreview component in new window
    let separateProps = {
      separateWindow,
      projectName: project?.name ?? "",
      onCloseSeparatePreview: closeSeparatePreview,
      onOpenShare: () => (showShareDialog = true),
      onExportPDF: exportAsPDF,
      onExportPNG: exportAsPNG,
      onExportSVG: exportAsSVG,
      onExportSourcesAsZip: exportSourcesAsZip,
    };
    let container = separateWindow.document.createElement("div");
    separateWindow.document.body.appendChild(container);
    mount(SeparatePreview, {
      target: container,
      props: separateProps,
    });

    separateWindow.addEventListener("beforeunload", closeSeparatePreview);

    // Subscribe to theme changes to update separate window
    theme.subscribe((value) => {
      if (separateWindow && !separateWindow.closed) {
        separateWindow.document.documentElement.setAttribute(
          "data-theme",
          value,
        );

        // Also set theme for preview iframe if it exists
        const previewIFrame = separateWindow.document.getElementById(
          "preview-iframe",
        ) as HTMLIFrameElement | null;
        previewIFrame?.contentDocument?.documentElement.setAttribute(
          "data-theme",
          value,
        );
      }
    });
  }

  function closeSeparatePreview() {
    if (separateWindow && !separateWindow.closed) {
      separateWindow.close();
    }
    separateWindow = null;
  }

  function toggleNegativePreview() {
    negativePreview = !negativePreview;

    // Apply negative class to preview svg
    const previewIframe = document.getElementById(
      "preview-iframe",
    ) as HTMLIFrameElement | null;
    const typstApp =
      previewIframe?.contentDocument?.querySelector("#typst-app");
    if (typstApp) {
      if (negativePreview) {
        typstApp.classList.add("negative");
      } else {
        typstApp.classList.remove("negative");
      }
    }

    // Apply negative class to separate window if open
    if (separateWindow && !separateWindow.closed) {
      const previewIframe = separateWindow.document.getElementById(
        "preview-iframe",
      ) as HTMLIFrameElement | null;
      const typstApp =
        previewIframe?.contentDocument?.querySelector("#typst-app");
      if (typstApp) {
        if (negativePreview) {
          typstApp.classList.add("negative");
        } else {
          typstApp.classList.remove("negative");
        }
      }
    }
  }
</script>

<svelte:head>
  <title>{project?.name ? `${project.name} - Collabst` : "Collabst"}</title>
</svelte:head>

{#if !project}
  <div class="loading">Loading project...</div>
{:else}
  <div class="container">
    <header>
      <div class="header-left">
        <Tooltip text={homeTooltip} position="bottom">
          <a href={homeHref} class="home-link">
            <IconButton icon={Home} variant="top-bar" size="md" />
          </a>
        </Tooltip>
        {#if isEditingProjectName}
          <input
            bind:this={projectNameInput}
            bind:value={editingProjectName}
            onblur={handleProjectRenameCancel}
            onkeydown={handleProjectRenameKeydown}
            class="project-name-input"
            type="text"
            onclick={(e) => e.stopPropagation()}
          />
        {:else}
          <button
            class="project-name-button"
            onclick={handleProjectNameClick}
            title={project.name}
            disabled={!canManageProject}
          >
            {project.name}
          </button>
        {/if}
        <MenuBar
          onNewFile={handleNewFileFromMenu}
          onUploadFile={() => (showUploadAssetModal = true)}
          onRenameFile={handleRenameSelectedItem}
          onDeleteFile={handleDeleteSelectedItem}
          onExportPDF={handleExportPDF}
          onExportPNG={handleExportPNG}
          onExportSVG={handleExportSVG}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSearchReplace={handleSearchReplace}
          onSelectAll={handleSelectAll}
          onToggleLineComment={handleToggleLineComment}
          onToggleBlockComment={handleToggleBlockComment}
          onAddComment={() => {
            if (!canComment) return;
            if (editorPane) {
              editorPane.handleAddComment();
              if (activePanel !== "comments") activePanel = "comments";
            }
          }}
          onShowToolbar={() => (showToolbar = !showToolbar)}
          onScrollOnType={() =>
            console.log("Scroll on type - to be implemented")}
          onWrapLines={() => (wrapLines = !wrapLines)}
          onThemeLight={() => theme.set("light")}
          onThemeDark={() => theme.set("dark")}
          onNegativePreview={toggleNegativePreview}
          {wrapLines}
          {negativePreview}
          {showToolbar}
          {canWrite}
          {canComment}
        />
      </div>

      {#if selectedAsset}
        <div class="header-center">
          {#if currentPath.folders.length > 0}
            <span class="path-folders">
              {#each currentPath.folders as folder, i}
                {folder}
                <ChevronRight size={15} class="path-chevron" />
              {/each}
            </span>
          {/if}
          <span class="current-file-name">{currentPath.filename}</span>
        </div>
      {:else if selectedFile}
        <div class="header-center">
          {#if currentPath.folders.length > 0}
            <span class="path-folders">
              {#each currentPath.folders as folder, i}
                {folder}
                <ChevronRight size={15} class="path-chevron" />
              {/each}
            </span>
          {/if}
          <span class="current-file-name">{currentPath.filename}</span>
        </div>
      {/if}

      <div class="header-rightr">
        <UserPresence provider={yjsConnection?.provider || null} />
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
    <div class="main">
      <ActivityBar
        {activePanel}
        onActivityClick={handleActivityClick}
        {diagnostics}
        {unresolvedCommentsCount}
      />

      {#if activePanel === "files"}
        <div style="width: {leftPanelWidth}px;">
          <FileTree
            {files}
            {assets}
            {loadingFileIds}
            {selectedItem}
            {previewFileId}
            onSelectFile={handleSelectFile}
            onSelectAsset={handleSelectAsset}
            onSetPreviewFile={handleSetPreviewFile}
            onRenameFile={canWrite ? handleRenameFile : null}
            onRenameAsset={canWrite ? handleRenameAsset : null}
            onMoveFile={canWrite ? handleMoveFile : null}
            onMoveAsset={canWrite ? handleMoveAsset : null}
            onDeleteFile={canWrite ? handleDeleteFile : null}
            onDeleteAsset={canWrite ? handleDeleteAsset : null}
            onClearSelection={handleClearSelection}
            onCreateFile={canWrite ? handleCreateFile : null}
            onCreateFolder={canWrite ? handleCreateFolder : null}
            onUploadAsset={canWrite ? () => (showUploadAssetModal = true) : null}
            provider={yjsConnection?.provider || null}
            {canWrite}
          />
        </div>
      {:else if activePanel === "search"}
        <div style="width: {leftPanelWidth}px;">
          <SearchPanel {files} ydoc={yjsConnection?.ydoc || null} {gotoMatch} />
        </div>
      {:else if activePanel === "outline"}
        <div style="width: {leftPanelWidth}px;">
          <PlaceholderPanel title="Outline" />
        </div>
      {:else if activePanel === "issues"}
        <div style="width: {leftPanelWidth}px;">
          <IssuesPanel {diagnostics} {gotoDiagnostic} />
        </div>
      {:else if activePanel === "comments"}
        <div style="width: {leftPanelWidth}px; height: 100%; overflow: hidden;">
          <CommentsPanel
            comments={editorComments}
            currentUserId={$auth.user?.id || ""}
            {canComment}
            canDeleteComments={canManageProject}
            newCommentDraft={editorNewCommentDraft}
            {activeCommentId}
            {hoveredCommentId}
            {commentPositions}
            {editorScrollTop}
            {editorContentHeight}
            {draftPosition}
            onResolve={(commentId: string) =>
              editorPane?.handleCommentResolve(commentId)}
            onReopen={(commentId: string) =>
              editorPane?.handleCommentReopen(commentId)}
            onDelete={(commentId: string) =>
              editorPane?.handleCommentDelete(commentId)}
            onReply={(commentId: string, content: string) =>
              editorPane?.handleCommentReply(commentId, content)}
            onSubmitNew={(content: string) =>
              editorPane?.handleSubmitNewComment(content)}
            onCancelNew={() => editorPane?.handleCancelNewComment()}
            onSelect={(commentId: string) => {
              activeCommentId = commentId;
              editorPane?.scrollToComment(commentId);
              // Recompute multiple times to catch scroll settling
              setTimeout(updateCommentPositions, 50);
              setTimeout(updateCommentPositions, 150);
              setTimeout(updateCommentPositions, 300);
            }}
            onHover={(commentId: string) => {
              document
                .querySelectorAll(
                  `.cm-comment-highlight[data-comment-id="${commentId}"]`,
                )
                .forEach((el) =>
                  el.classList.add("cm-comment-highlight-hovered"),
                );
            }}
            onHoverEnd={(commentId: string) => {
              document
                .querySelectorAll(
                  `.cm-comment-highlight[data-comment-id="${commentId}"]`,
                )
                .forEach((el) =>
                  el.classList.remove("cm-comment-highlight-hovered"),
                );
            }}
            onPanelScroll={(scrollTop: number) => {
              const scrollDOM = editorPane?.getEditorScrollDOM();
              if (scrollDOM) {
                isSyncingFromPanel = true;
                scrollDOM.scrollTop = scrollTop;
                editorScrollTop = scrollTop;
                updateCommentPositions();
                requestAnimationFrame(() => {
                  isSyncingFromPanel = false;
                });
              }
            }}
          />
        </div>
      {:else if activePanel === "settings"}
        <div style="width: {leftPanelWidth}px;">
          <SettingsPanel />
        </div>
      {/if}

      {#if activePanel}
        <button
          type="button"
          class="resize-handle"
          aria-label="Resize left panel"
          onmousedown={handleLeftResizeStart}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><circle cx="12" cy="12" r="1" /><circle
              cx="12"
              cy="5"
              r="1"
            /><circle cx="12" cy="19" r="1" /></svg
          >
        </button>
      {/if}

      <EditorPane
        bind:this={editorPane}
        {selectedFile}
        {selectedAsset}
        {assets}
        {files}
        commentsForAnchors={editorComments}
        ytext={selectedYtext}
        provider={yjsConnection?.provider || null}
        {isConnected}
        onGetAssetUrl={handleGetAssetUrl}
        onGetAssetBlob={handleGetAssetBlob}
        ydoc={yjsConnection?.ydoc || null}
        currentUserId={$auth.user?.id || ""}
        {diagnostics}
        {wrapLines}
        {showToolbar}
        {separateWindow}
        {closeSeparatePreview}
        onRenameAsset={handleRenameSelectedItem}
        onDeleteAsset={handleDeleteAsset}
        {activeCommentId}
        onCommentClick={(commentId: string) => {
          if (activePanel === "comments") {
            activeCommentId = commentId;
            updateCommentPositions();
          }
        }}
        onCommentHover={(commentId: string | null) => {
          hoveredCommentId = commentId;
        }}
        onNewCommentDraftChange={(d: { text: string; range: { from: number; to: number }; selectedText: string } | null) => editorNewCommentDraft = d}
        onDocChange={() => {
          if (activePanel === "comments") {
            updateCommentPositions();
          }
        }}
        onCreateComment={handleCreateComment}
        onResolveComment={handleResolveComment}
        onDeleteComment={handleDeleteComment}
        onReplyComment={handleReplyComment}
        onReopenComment={handleReopenComment}
        {canWrite}
        {canComment}
        canModerateComments={canManageProject}
      />

      <button
        type="button"
        class="resize-handle"
        aria-label="Resize right panel"
        onmousedown={handleRightResizeStart}
        style={separateWindow ? "visibility: hidden; position: absolute;" : ""}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><circle cx="12" cy="12" r="1" /><circle
            cx="12"
            cy="5"
            r="1"
          /><circle cx="12" cy="19" r="1" /></svg
        >
      </button>

      <div
        style="width: {previewPanelWidth}px; flex: 0 0 auto; {separateWindow
          ? 'visibility: hidden; position: absolute;'
          : ''}"
      >
        <PreviewPane
          files={filesWithContent}
          {assets}
          compileEnabled={!isHydratingFiles}
          mainFilePath={previewFilePath}
          onDiagnostics={handleDiagnostics}
          projectName={project.name}
          {negativePreview}
          onOpenShare={() => (showShareDialog = true)}
          bind:renderSession
          {showToolbar}
          {separateWindow}
          {openSeparatePreview}
          bind:exportAsPDF
          bind:exportAsPNG
          bind:exportAsSVG
          bind:exportSourcesAsZip
        />
      </div>
    </div>

    <DeleteConfirmModal
      show={showDeleteModal}
      message={deleteTarget
        ? `Are you sure you want to delete the ${deleteTarget.isFolder ? "folder" : deleteTarget.type === "file" ? "file" : "asset"} "${deleteTarget.name}"?${deleteTarget.isFolder ? " All its content will be permanently deleted." : " This action cannot be undone."}`
        : ""}
      onClose={() => {
        showDeleteModal = false;
        deleteTarget = null;
      }}
      onConfirm={confirmDelete}
    />

    <UploadAssetModal
      show={showUploadAssetModal}
      onClose={() => (showUploadAssetModal = false)}
      onUpload={handleUploadAsset}
    />

    <ShareDialog bind:show={showShareDialog} {project} />
  </div>
{/if}

<style>
  .container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  header {
    background: var(--bg-top-bar);
    padding: 0.25rem 0.5rem 0.25rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-primary);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-left: 45px;
  }

  .header-rightr {
    display: flex;
    align-items: center;
    gap: 0rem;
  }

  .header-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .path-folders {
    color: var(--text-tertiary);
    font-size: 14px;
    font-weight: 400;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .path-folders :global(.path-chevron) {
    color: var(--text-tertiary);
    flex-shrink: 0;
  }

  .current-file-name {
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 600;
  }

  .home-link {
    display: flex;
    align-items: center;
    text-decoration: none;
  }

  .project-name-button {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0;
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid transparent;
    max-width: 180px;
    box-sizing: border-box;
    display: inline-block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 22px;
    vertical-align: middle;
    background: transparent;
    color: var(--text-primary);
    font-family: inherit;
  }

  .project-name-button:hover {
    outline: 2px solid var(--color-primary-500);
    cursor: text;
  }

  .project-name-input {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    background: var(--surface-hover);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 8px;
    font-family: inherit;
    min-width: 100px;
    box-sizing: border-box;
    line-height: 22px;
  }

  .project-name-input:focus {
    border-color: var(--color-primary-500);
    outline: 2px solid var(--color-primary-500);
    outline-offset: 0px;
    background: var(--surface-hover);
    min-width: 200px;
  }

  .main {
    flex: 1;
    display: flex;
    overflow: hidden;
    padding-right: 12px;
  }

  .main > :global(.activity-bar) {
    flex-shrink: 0;
    width: 56px;
  }

  .main > :global(.file-tree),
  .main > :global(.placeholder-panel) {
    width: 100%;
    height: 100%;
  }

  .main > div:has(> :global(.file-tree)),
  .main > div:has(> :global(.placeholder-panel)) {
    display: flex;
    flex-direction: column;
    height: 100%;
    flex-shrink: 0;
    min-width: 200px;
  }

  .main > :global(.editor-pane) {
    flex: 1;
    min-width: 200px;
  }

  .main > :global(.preview-pane) {
    min-width: 200px;
    height: 100%;
    width: 100%;
  }

  .main > div:has(> :global(.preview-pane)) {
    height: 100%;
    overflow: visible;
  }

  .resize-handle {
    width: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    background: transparent;
    border: none;
    cursor: col-resize;
    user-select: none;
    overflow: visible;
    opacity: 0.4;
    transition:
      opacity 0.15s,
      color 0.15s;
  }

  .resize-handle svg {
    overflow: visible;
  }

  .resize-handle:hover {
    color: var(--text-secondary);
    opacity: 0.8;
  }

  .loading {
    font-family: "DM Serif Display", Georgia, serif;
    letter-spacing: -0.02em;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 50px;
    color: var(--text-secondary);
    background: var(--bg-top-bar);
  }
</style>
