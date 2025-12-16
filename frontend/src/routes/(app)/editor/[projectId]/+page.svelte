<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { browser } from '$app/environment'
  import { projectsApi, filesApi, assetsApi } from '$lib/services/api'
  import { createProjectYjs, destroyYjsConnection, getFileText } from '$lib/yjs'
  import { createProjectSync } from '$lib/projectSync'
  import { auth } from '$lib/stores/auth'
  import { notifications } from '$lib/stores/notifications'
  import { theme } from '$lib/stores/theme'
  import { ThemeToggle, ProfileMenu, IconButton, Tooltip, MenuBar } from '$lib/components/ui'
  import Home from '@lucide/svelte/icons/home'
  import ActivityBar from '$lib/components/editor/ActivityBar.svelte'
  import FileTree from '$lib/components/editor/FileTree.svelte'
  import PlaceholderPanel from '$lib/components/editor/PlaceholderPanel.svelte'
  import EditorPane from '$lib/components/editor/EditorPane.svelte'
  import CreateFileModal from '$lib/components/editor/CreateFileModal.svelte'
  import DeleteConfirmModal from '$lib/components/editor/DeleteConfirmModal.svelte'
  import UploadAssetModal from '$lib/components/editor/UploadAssetModal.svelte'
  import CollaboratorsPanel from '$lib/components/editor/CollaboratorsPanel.svelte'
  import UserPresence from '$lib/components/editor/UserPresence.svelte'
  import type { Project, File as ProjectFile, Asset, Diagnostic } from '$lib/types'
  import type { YjsConnection } from '$lib/yjs'
  import { addFileToCompiler, compileTypst, renderTypst, cleanupDeletedAssets, resetAssetCache } from "$lib/preview/compiler";
  import { parseRange } from '$lib/preview/diagnostics'
  import PreviewPane from '$lib/components/editor/PreviewPane.svelte'
  import { convertDiagnosticsToLint } from '$lib/preview/diagnostics'
  import { setDiagnostics } from '@codemirror/lint'

  let projectId = $derived($page.params.projectId)

  let project = $state<Project | null>(null)
  let files = $state<ProjectFile[]>([])
  let assets = $state<Asset[]>([])
  let selectedFile = $state<ProjectFile | null>(null)
  let selectedAsset = $state<Asset | null>(null)
  let previewFileId = $state<number | null>(null)
  let showCreateFileModal = $state(false)
  let showUploadAssetModal = $state(false)
  let showDeleteModal = $state(false)
  let deleteTarget = $state<{ type: 'file' | 'asset'; id: number; name: string } | null>(null)
  let showCollaborators = false
  let activePanel = $state<string | null>('files')
  let fileTreeHasFocus = $state(false)
  let isEditingProjectName = $state(false)
  let editingProjectName = $state('')
  let projectNameInput = $state<HTMLInputElement | undefined>()
  
  // Load toggle states from localStorage with defaults
  let wrapLines = $state(
    browser && localStorage.getItem('editor.wrapLines') !== null
      ? localStorage.getItem('editor.wrapLines') === 'true'
      : true
  )
  let negativePreview = $state(
    browser && localStorage.getItem('editor.negativePreview') !== null
      ? localStorage.getItem('editor.negativePreview') === 'true'
      : false
  )
  let showToolbar = $state(
    browser && localStorage.getItem('editor.showToolbar') !== null
      ? localStorage.getItem('editor.showToolbar') === 'true'
      : true
  )
  
  let editorPaneRef = $state<any>(null) // Reference to EditorPane component
  
  // Panel widths for resizable panels
  let leftPanelWidth = $state(250) // Default width in pixels
  let editorPanelWidth = 0 // Will be calculated
  let previewPanelWidth = $state(0) // Will be calculated
  const MIN_PANEL_WIDTH = 200 // Minimum width for any panel
  const ACTIVITY_BAR_WIDTH = 56 // Fixed activity bar width
  
  let isResizingLeft = false
  let isResizingRight = false
  let resizeStartX = 0
  let resizeStartWidth = 0
  let editorPane: any = null

  function handleActivityClick(activityId: string) {
    // Toggle: if clicking the same panel, close it; otherwise open the new panel
    if (activePanel === activityId) {
      activePanel = null
    } else {
      activePanel = activityId
    }
  }
  
  function handleLeftResizeStart(e: MouseEvent) {
    if (!activePanel) return
    isResizingLeft = true
    resizeStartX = e.clientX
    resizeStartWidth = leftPanelWidth
    e.preventDefault()
  }
  
  function handleRightResizeStart(e: MouseEvent) {
    isResizingRight = true
    resizeStartX = e.clientX
    resizeStartWidth = previewPanelWidth
    e.preventDefault()
  }
  
  function handleMouseMove(e: MouseEvent) {
    if (isResizingLeft) {
      const delta = e.clientX - resizeStartX
      const newWidth = resizeStartWidth + delta
      
      // Calculate available space: total width - activity bar - left panel - preview panel - resize handles - right padding
      const totalWidth = window.innerWidth
      const usedWidth = ACTIVITY_BAR_WIDTH + newWidth + previewPanelWidth + 12 + 12 + 16 // 12px per resize handle + 16px right padding
      const editorWidth = totalWidth - usedWidth
      
      // Only allow resize if editor maintains minimum width
      if (editorWidth >= MIN_PANEL_WIDTH) {
        leftPanelWidth = Math.max(MIN_PANEL_WIDTH, newWidth)
      }
    } else if (isResizingRight) {
      const delta = resizeStartX - e.clientX // Inverted for right panel
      const newWidth = resizeStartWidth + delta
      
      // Calculate available space: total width - activity bar - left panel - preview panel - resize handles - right padding
      const totalWidth = window.innerWidth
      const usedWidth = ACTIVITY_BAR_WIDTH + leftPanelWidth + newWidth + 12 + 12 + 16 // 12px per resize handle + 16px right padding
      const editorWidth = totalWidth - usedWidth
      
      // Only allow resize if editor maintains minimum width
      if (editorWidth >= MIN_PANEL_WIDTH) {
        previewPanelWidth = Math.max(MIN_PANEL_WIDTH, newWidth)
      }
    }
  }
  
  function handleMouseUp() {
    isResizingLeft = false
    isResizingRight = false
  }

  // Editor action handlers
  function handleUndo() {
    if (editorPaneRef && !selectedAsset) {
      editorPaneRef.undo()
    }
  }

  function handleRedo() {
    if (editorPaneRef && !selectedAsset) {
      editorPaneRef.redo()
    }
  }

  function handleSelectAll() {
    if (editorPaneRef && !selectedAsset) {
      editorPaneRef.selectAll()
    }
  }

  let isViewingAsset = $derived(!!selectedAsset)

  let yjsConnection = $state<YjsConnection | null>(null)
  let projectSync: any = null
  let isConnected = $state(false)
  let isSynced = false
  let isLocalSynced = false
  let hasConnectedBefore = false

  // Watch connection status changes
  $effect(() => {
    if (browser) {
      if (isConnected && hasConnectedBefore) {
        notifications.show('Reconnected. Syncing changes...', 'info')
      } else if (!isConnected && hasConnectedBefore) {
        notifications.show('Connection lost. Changes will sync when reconnected.', 'warning')
      }
      
      if (isConnected) {
        hasConnectedBefore = true
      }
    }
  })

  // Save toggle states to localStorage
  $effect(() => {
    if (browser) {
      localStorage.setItem('editor.wrapLines', String(wrapLines))
    }
  })

  $effect(() => {
    if (browser) {
      localStorage.setItem('editor.negativePreview', String(negativePreview))
    }
  })

  $effect(() => {
    if (browser) {
      localStorage.setItem('editor.showToolbar', String(showToolbar))
    }
  })

  async function loadProject() {
    try {
      project = await projectsApi.get(Number(projectId))
    } catch (error) {
      console.error('Failed to load project:', error)
    }
  }

  async function loadFiles() {
    try {
      const data = await filesApi.list(Number(projectId))
      files = data
      if (data.length > 0 && !selectedFile) {
        // Select preview file if set, otherwise select first file
        if (previewFileId) {
          selectedFile = data.find(f => f.id === previewFileId) || data[0]
        } else {
          selectedFile = data[0]
        }
      }
    } catch (error) {
      console.error('Failed to load files:', error)
    }
  }

  async function loadAssets() {
    try {
      const data = await assetsApi.list(Number(projectId))
      assets = data
    } catch (error) {
      console.error('Failed to load assets:', error)
    }
  }

  async function handleCreateFile(fileName: string) {
    try {
      const newFile = await filesApi.create(
        Number(projectId),
        fileName,
        `/${fileName}`,
        'typst',
        ''
      )
      if (!files.find(f => f.id === newFile.id)) {
        files = [...files, newFile]
      }
      selectedFile = newFile
      selectedAsset = null
      showCreateFileModal = false
    } catch (error) {
      console.error('Failed to create file:', error)
      alert('Failed to create file')
    }
  }

  async function handleUploadAsset(file: File) {
    try {
      const asset = await assetsApi.upload(Number(projectId), file)
      if (!assets.find(a => a.id === asset.id)) {
        assets = [...assets, asset]
      }
      showUploadAssetModal = false
    } catch (error) {
      console.error('Failed to upload asset:', error)
      alert('Failed to upload asset')
    }
  }

  function handleSelectFile(file: ProjectFile) {
    selectedFile = file
    selectedAsset = null
    // Awareness update handled by reactive statement
  }

  function handleSelectAsset(asset: Asset) {
    selectedAsset = asset
    // Keep selectedFile to prevent CodeEditor from being destroyed
    // Awareness update handled by reactive statement
  }

  function handleSetPreviewFile(fileId: number) {
    previewFileId = fileId
    if (browser) {
      localStorage.setItem(`preview-file-${projectId}`, String(fileId))
    }
  }

  async function handleDeleteFile(fileId: number) {
    const file = files.find(f => f.id === fileId)
    if (!file) return
    deleteTarget = { type: 'file', id: fileId, name: file.name }
    showDeleteModal = true
  }

  async function handleDeleteAsset(assetId: number) {
    const asset = assets.find(a => a.id === assetId)
    if (!asset) return
    deleteTarget = { type: 'asset', id: assetId, name: asset.filename }
    showDeleteModal = true
  }

  async function handleRenameFile(fileId: number, newName: string) {
    try {
      const updatedFile = await filesApi.update(Number(projectId), fileId, { name: newName })
      files = files.map(f => f.id === fileId ? updatedFile : f)
      if (selectedFile?.id === fileId) {
        selectedFile = updatedFile
      }
    } catch (error: any) {
      console.error('Failed to rename file:', error)
      const message = error?.response?.data?.detail || 'Failed to rename file'
      notifications.show(message, 'error', 5000)
      throw error // Re-throw to let FileTreeItem know it failed
    }
  }

  async function handleRenameAsset(assetId: number, newName: string) {
    try {
      const updatedAsset = await assetsApi.update(Number(projectId), assetId, { filename: newName })
      assets = assets.map(a => a.id === assetId ? updatedAsset : a)
      if (selectedAsset?.id === assetId) {
        selectedAsset = updatedAsset
      }
    } catch (error: any) {
      console.error('Failed to rename asset:', error)
      const message = error?.response?.data?.detail || 'Failed to rename asset'
      notifications.show(message, 'error', 5000)
      throw error // Re-throw to let FileTreeItem know it failed
    }
  }

  function handleRenameSelectedItem() {
    // Trigger rename in FileTree for currently selected item
    if (selectedAsset || selectedFile) {
      // Dispatch custom event to trigger rename in FileTree
      window.dispatchEvent(new CustomEvent('trigger-file-rename'))
    }
  }

  function handleDeleteSelectedItem() {
    // Delete currently selected file or asset
    if (selectedAsset) {
      handleDeleteAsset(selectedAsset.id)
    } else if (selectedFile) {
      handleDeleteFile(selectedFile.id)
    }
  }

  function handleProjectNameClick() {
    isEditingProjectName = true
    editingProjectName = project?.name || ''
    setTimeout(() => {
      projectNameInput?.select()
    }, 0)
  }

  async function handleProjectRenameSubmit() {
    const trimmedName = editingProjectName.trim()
    
    if (!project || !trimmedName || trimmedName === project.name) {
      isEditingProjectName = false
      return
    }

    try {
      const updatedProject = await projectsApi.update(Number(projectId), trimmedName)
      project = updatedProject
      isEditingProjectName = false
    } catch (error: any) {
      console.error('Failed to rename project:', error)
      const message = error?.response?.data?.detail || 'Failed to rename project'
      notifications.show(message, 'error', 5000)
      // Keep editing mode open on error
    }
  }

  function handleProjectRenameCancel() {
    isEditingProjectName = false
    editingProjectName = ''
  }

  function handleProjectRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleProjectRenameSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleProjectRenameCancel()
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    
    const targetId = deleteTarget.id
    const targetType = deleteTarget.type

    try {
      if (targetType === 'file') {
        await filesApi.delete(Number(projectId), targetId)
        files = files.filter(f => f.id !== targetId)
        if (selectedFile?.id === targetId) {
          selectedFile = files[0] || null
        }
      } else {
        await assetsApi.delete(Number(projectId), targetId)
        assets = assets.filter(a => a.id !== targetId)
        if (selectedAsset?.id === targetId) {
          selectedAsset = null
        }
      }
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      showDeleteModal = false
      deleteTarget = null
    }
  }

  async function handleGetAssetUrl(assetId: number): Promise<string> {
    const { url } = await assetsApi.getUrl(Number(projectId), assetId)
    return url
  }

  async function handleDownloadPDF() {
    if (!browser || !compiler || files.length === 0) {
      console.error("Compiler or files not ready for PDF export");
      return;
    }

    try {
      // Compile to PDF
      console.log(compiledResult);
      typst.pdf({mainFilePath:compiledMainPath}).then((pdfData: Uint8Array) => {
        // Convert Uint8Array to Blob - need to create a new Uint8Array with proper ArrayBuffer
        const pdfFile = new Blob([new Uint8Array(pdfData)], { type: 'application/pdf' });
        
        // Creates element with <a> tag
        const link = document.createElement('a');
        // Sets file content in the object URL
        link.href = URL.createObjectURL(pdfFile);
        // Sets file name
        link.download = project?.name ? `${project.name}.pdf` : 'document.pdf';
        // Triggers a click event to <a> tag to save file.
        link.click();
        URL.revokeObjectURL(link.href);
      });
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    }
  }

  function onFileCreated(file: ProjectFile) {
    if (!files.find(f => f.id === file.id)) {
      files = [...files, file]
    }
    if (yjsConnection?.ydoc) {
      const ytext = getFileText(yjsConnection.ydoc, file.id)
      if (ytext && ytext.length === 0 && file.content) {
        ytext.insert(0, file.content)
      }
    }
  }

  function onFileUpdated(file: ProjectFile) {
    files = files.map(f => f.id === file.id ? file : f)
    if (selectedFile?.id === file.id) {
      selectedFile = file
    }
  }

  function onFileDeleted(fileId: number) {
    files = files.filter(f => f.id !== fileId)
    if (selectedFile?.id === fileId) {
      selectedFile = files[0] || null
    }

    // Clean up Yjs data for the deleted file
    if (yjsConnection?.ydoc) {
      const ytext = yjsConnection.ydoc.getText(`file-${fileId}`)
      if (ytext && ytext.length > 0) {
        ytext.delete(0, ytext.length)
        console.log(`[YJS] Cleared Y.Text for deleted file-${fileId}`)
      }
    }
  }

  function onAssetCreated(asset: Asset) {
    if (!assets.find(a => a.id === asset.id)) {
      assets = [...assets, asset]
    }
  }

  function onAssetUpdated(asset: Asset) {
    assets = assets.map(a => a.id === asset.id ? asset : a)
    if (selectedAsset?.id === asset.id) {
      selectedAsset = asset
    }
  }

  function onAssetDeleted(assetId: number) {
    assets = assets.filter(a => a.id !== assetId)
    if (selectedAsset?.id === assetId) {
      selectedAsset = null
    }
  }

  function onProjectUpdated(updatedProject: Project) {
    if (project && updatedProject.id === project.id) {
      project = { ...project, ...updatedProject }
    }
  }

  onMount(() => {
    // Load preview file from localStorage first
    if (browser) {
      const savedPreviewId = localStorage.getItem(`preview-file-${projectId}`)
      if (savedPreviewId) {
        previewFileId = parseInt(savedPreviewId, 10)
      }
      
      // Initialize panel widths based on current window size
      const windowWidth = window.innerWidth
      const availableWidth = windowWidth - ACTIVITY_BAR_WIDTH - 16 // 16px for padding
      
      if (activePanel) {
        // When left panel is open: split remaining space between editor and preview
        const remainingWidth = availableWidth - leftPanelWidth - 24 // 24px for resize handles
        previewPanelWidth = Math.max(MIN_PANEL_WIDTH, remainingWidth * 0.4) // 40% for preview
      } else {
        // When left panel is closed: split between editor and preview
        previewPanelWidth = Math.max(MIN_PANEL_WIDTH, availableWidth * 0.4)
      }
    }

    loadProject()
    loadFiles()
    loadAssets()

    yjsConnection = createProjectYjs(Number(projectId), (status) => {
      isConnected = status.isConnected
      isSynced = status.isSynced
      isLocalSynced = status.isLocalSynced
    }, $auth.user)

    projectSync = createProjectSync(Number(projectId), {
      onFileCreated,
      onFileUpdated,
      onFileDeleted,
      onAssetCreated,
      onAssetUpdated,
      onAssetDeleted,
      onProjectUpdated,
    })
    
    const handleBeforeUnload = () => {
      if (yjsConnection?.provider?.awareness) {
        yjsConnection.provider.awareness.setLocalState(null)
      }
    }
    
    // Handle Cmd+S / Ctrl+S, F2 for rename, and Delete for delete
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        notifications.show('All changes are saved automatically', 'info', 2000)
      } else if (e.key === 'F2') {
        e.preventDefault()
        handleRenameSelectedItem()
      } else if (e.key === 'Delete' && (selectedFile || selectedAsset) && fileTreeHasFocus) {
        // Only delete file/asset when file tree panel has focus
        e.preventDefault()
        handleDeleteSelectedItem()
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  })

  onDestroy(() => {
    fileObservers.forEach(unobserve => unobserve())
    fileObservers.clear()
    if (yjsConnection) destroyYjsConnection(yjsConnection)
    if (projectSync) projectSync.destroy()
    resetAssetCache()
  })

  // Clean up deleted/renamed assets and files when arrays change
  $effect(() => {
    if (compiler && assets && files) {
      cleanupDeletedAssets(compiler, assets, files)
    }
  })

  let selectedYtext = $derived(selectedFile && yjsConnection?.ydoc
    ? getFileText(yjsConnection.ydoc, selectedFile.id)
    : null)

  let fileObservers = new Map<number, () => void>()

  $effect(() => {
    if (browser && yjsConnection?.ydoc && files.length > 0) {
      const ydoc = yjsConnection.ydoc
      
      // Clear old observers
      fileObservers.forEach(unobserve => unobserve())
      fileObservers.clear()

      // Set up observers for all files
      files.forEach(file => {
        const ytext = getFileText(ydoc, file.id)
        
        // Initialize file content if empty
        if (ytext && ytext.length === 0 && file.content) {
          ytext.insert(0, file.content)
        }

        // Observe changes in all files
        if (ytext) {
          const handler = () => triggerCompile()
          ytext.observe(handler)
          fileObservers.set(file.id, () => ytext.unobserve(handler))
        }
      })

      // Trigger initial compile
      if (selectedFile && compiler && renderer) {
        triggerCompile()
      }
    }
  })

  // Clean up observers when files change or component unmounts
  $effect(() => {
    if (browser && files.length === 0) {
      fileObservers.forEach(unobserve => unobserve())
      fileObservers.clear()
    }
  })

  // Trigger recompile when assets change (they may be referenced in typst files)
  $effect(() => {
    if (browser && assets && compiler && renderer && selectedFile) {
      triggerCompile()
    }
  })

  // Prioritize asset when both are set (asset is what user is actually viewing)
  let selectedItem = $derived(selectedAsset || selectedFile)

  // Update awareness when selected item changes - prioritize asset when viewing
  $effect(() => {
    if (selectedAsset && yjsConnection?.provider?.awareness) {
      yjsConnection.provider.awareness.setLocalStateField('currentItem', {
        id: selectedAsset.id,
        isAsset: true
      })
    } else if (selectedFile && yjsConnection?.provider?.awareness) {
      yjsConnection.provider.awareness.setLocalStateField('currentItem', {
        id: selectedFile.id,
        isAsset: false
      })
    } else if (yjsConnection?.provider?.awareness) {
      yjsConnection.provider.awareness.setLocalStateField('currentItem', null)
    }
  })

  // Typst compiler and renderer
  let typst: any = null;
  let compiler: any = null;
  let renderer: any = null;
  let diagnostics = $state<Diagnostic[]>([]);
  let previewHtml = $state<string>("");
  let compiledResult: any = null;
  let compiledMainPath: string = "";

  let isLoading: boolean = true;
  let version: string = "0.7.0-rc1";
  let isCompiling = false;
  let pendingCompile = false;

  const triggerCompile = debounce(() => update(), 50);

  function debounce<T extends (...args: any[]) => void>(fn: T, delay = 400) {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  onMount(async () => {
    // Check if already loaded
    if ((window as any).$typst) {
      typst = (window as any).$typst;
      compiler = await typst.getCompiler();
      renderer = await typst.getRenderer();
      isLoading = false;
      return;
    }

    // Only load script if not already present
    if (document.querySelector(`script[src*="typst.ts@${version}"]`)) {
      return;
    }

    const script = document.createElement("script");
    script.type = "module";
    script.src = `https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts@${version}/dist/esm/contrib/all-in-one-lite.bundle.js`;

    script.onload = async () => {
      typst = (window as any).$typst;

      typst.setCompilerInitOptions({
        getModule: () =>
          `https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@${version}/pkg/typst_ts_web_compiler_bg.wasm`,
      });

      typst.setRendererInitOptions({
        getModule: () =>
          `https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer@${version}/pkg/typst_ts_renderer_bg.wasm`,
      });

      compiler = await typst.getCompiler();
      renderer = await typst.getRenderer();
      isLoading = false;
    };
    document.head.appendChild(script);
  });

  $effect(() => {
    if (!isLoading && compiler && renderer && selectedFile && previewFileId !== null) {
      triggerCompile();
    }
  })

  async function update() {
    if (!browser || !compiler || !renderer || !selectedFile) return;

    if (isCompiling) {
      pendingCompile = true;
      return;
    }

    isCompiling = true;

    try {
      const filesWithContent = files.map((file) => {
        const ytextForFile = yjsConnection?.ydoc
          ? getFileText(yjsConnection.ydoc, file.id)
          : null;

        return {
          ...file,
          content: ytextForFile ? ytextForFile.toString() : file.content,
        };
      });

      await addFileToCompiler(compiler, filesWithContent, Number(projectId));
      await addFileToCompiler(compiler, assets, Number(projectId));

      // Use preview file if set, otherwise default to main.typ or first .typ file
      const previewFile = previewFileId
        ? filesWithContent.find(f => f.id === previewFileId)
        : filesWithContent.find(f => f.name === 'main.typ') || filesWithContent.find(f => f.name.endsWith('.typ'));

      if (!previewFile) {
        console.warn("No .typ file found for preview");
        return;
      }

      const mainFilePath = previewFile.path;
      const normalizedMainPath = mainFilePath.startsWith("/")
        ? mainFilePath
        : `/${mainFilePath}`;

      const result = await compileTypst(compiler, normalizedMainPath);

      if (result.diagnostics && result.diagnostics.length > 0) {
        diagnostics = result.diagnostics.map((d: any) => ({
          severity: d.severity,
          message: d.message,
          range: parseRange(d.range),
          path: d.path,
        }));
      } else {
        diagnostics = [];
      }

      updateLinter();

      if (result.result && !result.hasError) {
        compiledResult = result.result;
        compiledMainPath = normalizedMainPath;
        previewHtml = await renderTypst(renderer, result.result);
      } else {
        // Keep the last rendered state on error
        console.error("Compilation failed:", {
          hasError: result.hasError,
          diagnostics: diagnostics,
          mainFile: normalizedMainPath
        });
      }
    } catch (error) {
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        mainFile: selectedFile?.path,
        filesCount: files.length,
        assetsCount: assets.length
      });
    } finally {
      isCompiling = false;
      if (pendingCompile) {
        pendingCompile = false;
        update();
      }
    }
  }

  function updateLinter() {
    const editorView = editorPane?.getEditorView?.()
    if (editorView) {
      const lintDiagnostics = convertDiagnosticsToLint(diagnostics, editorView, selectedFile?.path || '')
      const transaction = setDiagnostics(editorView.state, lintDiagnostics)
      editorView.dispatch(transaction)
    }
  }
</script>

<svelte:head>
  <title>{project?.name ? `${project.name} - Collabst` : 'Collabst'}</title>
</svelte:head>

{#if !project}
  <div class="loading">Loading project...</div>
{:else}
  <div class="container">
    <header>
      <div class="header-left">
        <Tooltip text="Back to dashboard" position="bottom">
          <button onclick={() => goto('/projects')} class="home-btn">
            <Home size={20} />
          </button>
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
          <h1 onclick={handleProjectNameClick} title={project.name}>{project.name}</h1>
        {/if}
        <MenuBar
          onNewFile={() => showCreateFileModal = true}
          onUploadFile={() => showUploadAssetModal = true}
          onRenameFile={handleRenameSelectedItem}
          onDeleteFile={handleDeleteSelectedItem}
          onExportPDF={handleDownloadPDF}
          onExportPNG={() => console.log('Export PNG - to be implemented')}
          onExportSVG={() => console.log('Export SVG - to be implemented')}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSearchReplace={() => console.log('Search and replace - to be implemented')}
          onSelectAll={handleSelectAll}
          onToggleLineComment={() => console.log('Toggle line comment - to be implemented')}
          onToggleBlockComment={() => console.log('Toggle block comment - to be implemented')}
          onAddComment={() => console.log('Add comment - to be implemented')}
          onShowToolbar={() => showToolbar = !showToolbar}
          onScrollOnType={() => console.log('Scroll on type - to be implemented')}
          onWrapLines={() => wrapLines = !wrapLines}
          onThemeLight={() => theme.set('light')}
          onThemeDark={() => theme.set('dark')}
          onNegativePreview={() => negativePreview = !negativePreview}
          {wrapLines}
          {negativePreview}
          {showToolbar}
        />
      </div>

      {#if selectedAsset}
        <div class="header-center">
          <span class="current-file-name">{selectedAsset.filename}</span>
          <span class="current-file-type">{selectedAsset.mime_type}</span>
        </div>
      {:else if selectedFile}
        <div class="header-center">
          <span class="current-file-name">{selectedFile.name}</span>
          <span class="current-file-type">{selectedFile.type}</span>
        </div>
      {/if}

      <div class="header-rightr">
        <UserPresence provider={yjsConnection?.provider || null} />
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
    <div class="main">
      <ActivityBar {activePanel} onActivityClick={handleActivityClick} />
      
      {#if activePanel === 'files'}
        <div 
          style="width: {leftPanelWidth}px;" 
          tabindex="-1"
          onfocus={() => fileTreeHasFocus = true}
          onblur={() => fileTreeHasFocus = false}
          onclick={() => fileTreeHasFocus = true}
        >
          <FileTree
            {files}
            {assets}
            selectedItem={selectedItem}
            {previewFileId}
            onSelectFile={handleSelectFile}
            onSelectAsset={handleSelectAsset}
            onSetPreviewFile={handleSetPreviewFile}
            onRenameFile={handleRenameFile}
            onRenameAsset={handleRenameAsset}
            onCreateFile={() => showCreateFileModal = true}
            onCreateFolder={() => console.log('Create folder - to be implemented')}
            onUploadAsset={() => showUploadAssetModal = true}
            provider={yjsConnection?.provider || null}
          />
        </div>
      {:else if activePanel === 'search'}
        <div style="width: {leftPanelWidth}px;">
          <PlaceholderPanel title="Search" />
        </div>
      {:else if activePanel === 'outline'}
        <div style="width: {leftPanelWidth}px;">
          <PlaceholderPanel title="Outline" />
        </div>
      {:else if activePanel === 'issues'}
        <div style="width: {leftPanelWidth}px;">
          <PlaceholderPanel title="Issues and Suggestions" />
        </div>
      {:else if activePanel === 'comments'}
        <div style="width: {leftPanelWidth}px;">
          <PlaceholderPanel title="Comments" />
        </div>
      {:else if activePanel === 'settings'}
        <div style="width: {leftPanelWidth}px;">
          <PlaceholderPanel title="Settings" />
        </div>
      {/if}

      {#if activePanel}
        <div class="resize-handle" onmousedown={handleLeftResizeStart}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </div>
      {/if}

      <EditorPane
        {selectedFile}
        {selectedAsset}
        ytext={selectedYtext}
        provider={yjsConnection?.provider || null}
        {isConnected}
        onGetAssetUrl={handleGetAssetUrl}
        ydoc={yjsConnection?.ydoc || null}
        currentUserId={$auth.user?.id || 0}
        currentUserName={$auth.user?.username || 'Unknown'}
        currentUserColor={yjsConnection?.provider?.awareness?.getLocalState()?.color || '#3b82f6'}
        {diagnostics}
        {wrapLines}
        {showToolbar}
      />

      <div class="resize-handle" onmousedown={handleRightResizeStart}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </div>

      <div style="width: {previewPanelWidth}px; flex: 0 0 auto;">
        <PreviewPane
          {previewHtml}
          onDownloadPDF={handleDownloadPDF}
          {negativePreview}
          panelWidth={previewPanelWidth}
          {showToolbar}
        />
      </div>
    </div>

    <CreateFileModal
      show={showCreateFileModal}
      onClose={() => showCreateFileModal = false}
      onSubmit={handleCreateFile}
    />

    <DeleteConfirmModal
      show={showDeleteModal}
      message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : ''}
      onClose={() => { showDeleteModal = false; deleteTarget = null }}
      onConfirm={confirmDelete}
    />

    <UploadAssetModal
      show={showUploadAssetModal}
      onClose={() => showUploadAssetModal = false}
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
    padding: 0.3rem 1rem;
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
    gap: 0.75rem;
  }

  .header-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .current-file-name {
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 600;
  }

  .current-file-type {
    color: var(--text-tertiary);
    font-size: 12px;
    text-transform: uppercase;
  }

  .home-btn {
    background: transparent;
    color: var(--text-secondary);
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .home-btn:hover {
    color: var(--text-primary);
  }

  h1 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    cursor: pointer;
    padding: 4px 8px;
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
  }

  h1:hover {
    border-color: var(--border);
  }

  .project-name-input {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    background: var(--surface-hover);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 4px 8px;
    font-family: inherit;
    min-width: 100px;
    max-width: 180px;
    box-sizing: border-box;
    line-height: 22px;
  }

  .project-name-input:focus {
    border-color: var(--color-primary-500);
    outline: 2px solid var(--color-primary-500);
    outline-offset: 0px;
    background: var(--surface-hover);
    max-width: 180px;
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
    transition: opacity 0.15s, color 0.15s;
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
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: var(--text-secondary);
  }
</style>
