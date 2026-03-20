<script lang="ts">
  import { mount, onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { projectsApi, filesApi, assetsApi } from "$lib/services/api";
  import {
    createProjectYjs,
    destroyYjsConnection,
    getFileText,
  } from "$lib/yjs";
  import { createProjectSync } from "$lib/projectSync";
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

  let projectId = $derived($page.params.projectId);

  let project = $state<Project | null>(null);
  let files = $state<ProjectFile[]>([]);
  let assets = $state<Asset[]>([]);
  let selectedFile = $state<ProjectFile | null>(null);
  let selectedAsset = $state<Asset | null>(null);
  let previewFileId = $state<number | null>(null);
  let showUploadAssetModal = $state(false);
  let showDeleteModal = $state(false);
  let deleteTarget = $state<{
    type: "file" | "asset";
    id: number;
    name: string;
    isFolder?: boolean;
  } | null>(null);
  let showCollaborators = false;
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
    resizeStartX = e.clientX;
    resizeStartWidth = leftPanelWidth;
    createDragOverlay();
    e.preventDefault();
  }

  function handleRightResizeStart(e: MouseEvent) {
    isResizingRight = true;
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

  let yjsConnection = $state<YjsConnection | null>(null);
  let projectSync: any = null;
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

  async function loadProject() {
    try {
      project = await projectsApi.get(Number(projectId));
    } catch (error) {
      console.error("Failed to load project:", error);
    }
  }

  async function loadFiles() {
    try {
      const data = await filesApi.list(Number(projectId));
      files = data;

      // If project has no files, create main.typ automatically
      if (data.length === 0) {
        try {
          const mainFile = await filesApi.create(
            Number(projectId),
            "main.typ",
            "/",
            "typst",
            "",
            null,
          );
          files = [mainFile];
          selectedFile = mainFile;
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
    } catch (error) {
      console.error("Failed to load files:", error);
    }
  }

  async function loadAssets() {
    try {
      const data = await assetsApi.list(Number(projectId));
      assets = data;
    } catch (error) {
      console.error("Failed to load assets:", error);
    }
  }

  async function handleCreateFile(fileName: string, parentId: number | null) {
    try {
      const newFile = await filesApi.create(
        Number(projectId),
        fileName,
        "/", // Path will be computed by backend
        "typst",
        "",
        parentId,
      );
      if (!files.find((f) => f.id === newFile.id)) {
        files = [...files, newFile];
      }
      selectedFile = newFile;
      selectedAsset = null;
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
    parentId: number | null,
  ) {
    try {
      const newFolder = await filesApi.createFolder(
        Number(projectId),
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

  async function handleUploadAsset(file: File) {
    try {
      // Determine parent: if selected item is a folder, create inside it; otherwise create at root
      const parentId = selectedFile?.is_folder ? selectedFile.id : null;

      const asset = await assetsApi.upload(Number(projectId), file, parentId);

      // Cache the uploaded asset immediately
      const arrayBuffer = await file.arrayBuffer();
      cacheAsset(
        Number(projectId),
        asset.id,
        asset.storage_path,
        asset.mime_type,
        arrayBuffer,
      ).catch((err) => console.warn("Failed to cache uploaded asset:", err));

      if (!assets.find((a) => a.id === asset.id)) {
        assets = [...assets, asset];
      }
      showUploadAssetModal = false;
      notifications.show("Asset uploaded successfully", "info");
    } catch (error: any) {
      console.error("Failed to upload asset:", error);
      const message = error?.response?.data?.detail || "Failed to upload asset";
      notifications.show(message, "error", 5000);
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
    // Awareness update handled by reactive statement
  }

  function handleSelectAsset(asset: Asset) {
    selectedAsset = asset;
    // Keep selectedFile to prevent CodeEditor from being destroyed
    // Awareness update handled by reactive statement
  }

  function handleClearSelection() {
    selectedFile = null;
    selectedAsset = null;
  }

  function handleSetPreviewFile(fileId: number) {
    previewFileId = fileId;
    if (browser) {
      localStorage.setItem(`preview-file-${projectId}`, String(fileId));
    }
  }

  async function handleDeleteFile(fileId: number) {
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

  async function handleDeleteAsset(assetId: number) {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    deleteTarget = { type: "asset", id: assetId, name: asset.filename };
    showDeleteModal = true;
  }

  async function handleRenameFile(fileId: number, newName: string) {
    try {
      const updatedFile = await filesApi.update(Number(projectId), fileId, {
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

  async function handleRenameAsset(assetId: number, newName: string) {
    try {
      const updatedAsset = await assetsApi.update(Number(projectId), assetId, {
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
    // Trigger inline file creation in FileTree
    window.dispatchEvent(new CustomEvent("trigger-new-file"));
  }

  function handleNewFolderFromMenu() {
    // Trigger inline folder creation in FileTree
    window.dispatchEvent(new CustomEvent("trigger-new-folder"));
  }

  function handleDeleteSelectedItem() {
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

  async function handleMoveFile(fileId: number, targetFolderId: number | null) {
    try {
      // Check if already in target location
      const fileToMove = files.find((f) => f.id === fileId);
      if (fileToMove && fileToMove.parent_id === targetFolderId) {
        // Already in target location, don't move
        return;
      }

      const updatedFile = await filesApi.move(
        Number(projectId),
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
    assetId: number,
    targetFolderId: number | null,
  ) {
    try {
      // Check if already in target location
      const assetToMove = assets.find((a) => a.id === assetId);
      if (assetToMove && assetToMove.parent_id === targetFolderId) {
        // Already in target location, don't move
        return;
      }

      const updatedAsset = await assetsApi.move(
        Number(projectId),
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
    isEditingProjectName = true;
    editingProjectName = project?.name || "";
    setTimeout(() => {
      projectNameInput?.select();
    }, 0);
  }

  async function handleProjectRenameSubmit() {
    const trimmedName = editingProjectName.trim();

    if (!project || !trimmedName || trimmedName === project.name) {
      isEditingProjectName = false;
      return;
    }

    try {
      const updatedProject = await projectsApi.update(
        Number(projectId),
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
    if (!deleteTarget) return;

    const targetId = deleteTarget.id;
    const targetType = deleteTarget.type;

    try {
      if (targetType === "file") {
        await filesApi.delete(Number(projectId), targetId);
        files = files.filter((f) => f.id !== targetId);
        if (selectedFile?.id === targetId) {
          selectedFile = files[0] || null;
        }
      } else {
        await assetsApi.delete(Number(projectId), targetId);
        // Remove from cache
        removeCachedAsset(Number(projectId), targetId).catch((err) =>
          console.warn("Failed to remove asset from cache:", err),
        );
        assets = assets.filter((a) => a.id !== targetId);
        if (selectedAsset?.id === targetId) {
          selectedAsset = null;
        }
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      showDeleteModal = false;
      deleteTarget = null;
    }
  }

  async function handleGetAssetUrl(assetId: number): Promise<string> {
    const { url } = await assetsApi.getUrl(Number(projectId), assetId);
    return url;
  }

  async function handleGetAssetBlob(asset: Asset): Promise<string> {
    // Try cache first
    const cached = await getCachedAsset(
      Number(projectId),
      asset.id,
      asset.storage_path,
    );
    if (cached) {
      return createBlobUrl(cached.blob, cached.mimeType);
    }

    // Fetch from API and cache
    const { url } = await assetsApi.getUrl(Number(projectId), asset.id);
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    // Cache for future use (fire and forget)
    cacheAsset(
      Number(projectId),
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

  function onFileDeleted(fileId: number) {
    files = files.filter((f) => f.id !== fileId);
    if (selectedFile?.id === fileId) {
      selectedFile = files[0] || null;
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

  function onAssetDeleted(assetId: number) {
    // Remove from cache
    removeCachedAsset(Number(projectId), assetId).catch((err) =>
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
    }
  }

  onMount(() => {
    // Initialize asset cache and load data asynchronously
    (async () => {
      await initAssetCache();

      // Load preview file from localStorage first
      if (browser) {
        const savedPreviewId = localStorage.getItem(
          `preview-file-${projectId}`,
        );
        if (savedPreviewId) {
          previewFileId = parseInt(savedPreviewId, 10);
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

      loadProject();
      loadFiles();
      loadAssets();

      yjsConnection = createProjectYjs(
        Number(projectId),
        (status) => {
          isConnected = status.isConnected;
          isSynced = status.isSynced;
          isLocalSynced = status.isLocalSynced;
        },
        $auth.user,
      );

      projectSync = createProjectSync(Number(projectId), {
        onFileCreated,
        onFileUpdated,
        onFileDeleted,
        onAssetCreated,
        onAssetUpdated,
        onAssetDeleted,
        onProjectUpdated,
      });
    })();

    const handleBeforeUnload = () => {
      if (yjsConnection?.provider?.awareness) {
        yjsConnection.provider.awareness.setLocalState(null);
      }
      closeSeparatePreview();
    };

    // Handle keyboard shortcuts: Ctrl+S, Ctrl+Shift+S, F2, Delete, Ctrl+/, Ctrl+Shift+A, Ctrl+F
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        !e.altKey &&
        (e.key.toLowerCase() === "s" || e.code === "KeyS")
      ) {
        // Ctrl+Shift+S for export PDF - capture and stop propagation early
        // so browser/extension handlers are less likely to win this shortcut.
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
        e.preventDefault();
        handleRenameSelectedItem();
      } else if (
        e.key === "Delete" &&
        (selectedFile || selectedAsset) &&
        fileTreeHasFocus
      ) {
        // Only delete file/asset when file tree panel has focus
        e.preventDefault();
        handleDeleteSelectedItem();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "/" || (e.shiftKey && e.key === ":"))
      ) {
        // Ctrl+/ for line comment (including azerty support where / requires shift)
        e.preventDefault();
        e.stopPropagation();
        handleToggleLineComment();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "A") {
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
    if (yjsConnection) destroyYjsConnection(yjsConnection);
    if (projectSync) projectSync.destroy();
  });

  let selectedYtext = $derived(
    selectedFile && yjsConnection?.ydoc
      ? getFileText(yjsConnection.ydoc, selectedFile.id)
      : null,
  );

  // Track file observers for Yjs content changes
  let fileObservers = new Map<number, () => void>();
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
      currentUser.name !== user.username
    ) {
      awareness.setLocalStateField("user", {
        id: user.id,
        name: user.username,
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
        <Tooltip text="Back to dashboard" position="bottom">
          <a href="/projects" class="home-link">
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
            {selectedItem}
            {previewFileId}
            onSelectFile={handleSelectFile}
            onSelectAsset={handleSelectAsset}
            onSetPreviewFile={handleSetPreviewFile}
            onRenameFile={handleRenameFile}
            onRenameAsset={handleRenameAsset}
            onMoveFile={handleMoveFile}
            onMoveAsset={handleMoveAsset}
            onDeleteFile={handleDeleteFile}
            onDeleteAsset={handleDeleteAsset}
            onClearSelection={handleClearSelection}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onUploadAsset={() => (showUploadAssetModal = true)}
            provider={yjsConnection?.provider || null}
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
            currentUserId={$auth.user?.id || 0}
            newCommentDraft={editorNewCommentDraft}
            {activeCommentId}
            {hoveredCommentId}
            {commentPositions}
            {editorScrollTop}
            {editorContentHeight}
            {draftPosition}
            onResolve={(commentId: string) =>
              editorPane?.handleCommentResolve(commentId)}
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
        <div
          class="resize-handle"
          role="separator"
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
        </div>
      {/if}

      <EditorPane
        bind:this={editorPane}
        {selectedFile}
        {selectedAsset}
        {assets}
        {files}
        ytext={selectedYtext}
        provider={yjsConnection?.provider || null}
        {isConnected}
        onGetAssetUrl={handleGetAssetUrl}
        onGetAssetBlob={handleGetAssetBlob}
        ydoc={yjsConnection?.ydoc || null}
        currentUserId={$auth.user?.id || 0}
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
        onCommentsChange={(c: Comment[]) => (editorComments = c)}
        onNewCommentDraftChange={(
          d: {
            text: string;
            range: { from: number; to: number };
            selectedText: string;
          } | null,
        ) => (editorNewCommentDraft = d)}
        onDocChange={() => {
          if (activePanel === "comments") {
            updateCommentPositions();
          }
        }}
      />

      <div
        class="resize-handle"
        role="separator"
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
      </div>

      <div
        style="width: {previewPanelWidth}px; flex: 0 0 auto; {separateWindow
          ? 'visibility: hidden; position: absolute;'
          : ''}"
      >
        <PreviewPane
          files={filesWithContent}
          {assets}
          mainFilePath={previewFilePath}
          onDiagnostics={handleDiagnostics}
          projectName={project.name}
          {negativePreview}
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

  .resize-handle:active {
    color: var(--primary);
    opacity: 1;
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
