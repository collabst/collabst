<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { browser } from '$app/environment'
  import { projectsApi, filesApi, assetsApi } from '$lib/services/api'
  import { createProjectYjs, destroyYjsConnection, getFileText } from '$lib/yjs'
  import { createProjectSync } from '$lib/projectSync'
  import { auth } from '$lib/stores/auth'
  import { ThemeToggle, ProfileMenu, IconButton, Tooltip } from '$lib/components/ui'
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
  import { addFileToCompiler, compileTypst, renderTypst, renderPDF, cleanupDeletedAssets, resetAssetCache } from "$lib/preview/compiler";
  import { parseRange } from '$lib/preview/diagnostics'
  import PreviewPane from '$lib/components/editor/PreviewPane.svelte'

  $: projectId = $page.params.projectId

  let project: Project | null = null
  let files: ProjectFile[] = []
  let assets: Asset[] = []
  let selectedFile: ProjectFile | null = null
  let selectedAsset: Asset | null = null
  let previewFileId: number | null = null
  let showCreateFileModal = false
  let showUploadAssetModal = false
  let showDeleteModal = false
  let deleteTarget: { type: 'file' | 'asset'; id: number; name: string } | null = null
  let showCollaborators = false
  let activePanel: string | null = 'files'

  function handleActivityClick(activityId: string) {
    // Toggle: if clicking the same panel, close it; otherwise open the new panel
    if (activePanel === activityId) {
      activePanel = null
    } else {
      activePanel = activityId
    }
  }

  let yjsConnection: YjsConnection | null = null
  let projectSync: any = null
  let isConnected = false
  let isSynced = false
  let isLocalSynced = false
  
  // Notification system
  let notification: { message: string; type: 'info' | 'warning' | 'error' } | null = null
  let notificationTimeout: number | null = null
  let hasConnectedBefore = false

  function showNotification(message: string, type: 'info' | 'warning' | 'error' = 'info', duration = 3000) {
    if (!browser) return
    
    notification = { message, type }
    if (notificationTimeout) clearTimeout(notificationTimeout)
    
    if (duration > 0) {
      notificationTimeout = window.setTimeout(() => {
        hideNotification()
      }, duration)
    }
  }

  function hideNotification() {
    if (!notification) return
    notification = { ...notification, message: notification.message + '__closing' }
    setTimeout(() => {
      notification = null
    }, 300) // Match animation duration
  }

  // Watch connection status changes
  $: if (browser) {
    if (isConnected && hasConnectedBefore) {
      showNotification('Reconnected. Syncing changes...', 'info'  )
    } else if (!isConnected && hasConnectedBefore) {
      showNotification('Connection lost. Changes will sync when reconnected.', 'warning')
    }
    
    if (isConnected) {
      hasConnectedBefore = true
    }
  }

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

  async function confirmDelete() {
    if (!deleteTarget) return

    try {
      if (deleteTarget.type === 'file') {
        await filesApi.delete(Number(projectId), deleteTarget.id)
        files = files.filter(f => f.id !== deleteTarget.id)
        if (selectedFile?.id === deleteTarget.id) {
          selectedFile = files[0] || null
        }
      } else {
        await assetsApi.delete(Number(projectId), deleteTarget.id)
        assets = assets.filter(a => a.id !== deleteTarget.id)
        if (selectedAsset?.id === deleteTarget.id) {
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
      typst.pdf({mainFilePath:compiledMainPath}).then(pdfData => {
        var pdfFile = new Blob([pdfData], { type: 'application/pdf' });
        
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

  function onAssetDeleted(assetId: number) {
    assets = assets.filter(a => a.id !== assetId)
    if (selectedAsset?.id === assetId) {
      selectedAsset = null
    }
  }

  onMount(() => {
    // Load preview file from localStorage first
    if (browser) {
      const savedPreviewId = localStorage.getItem(`preview-file-${projectId}`)
      if (savedPreviewId) {
        previewFileId = parseInt(savedPreviewId, 10)
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
      onAssetDeleted,
    })
    
    const handleBeforeUnload = () => {
      if (yjsConnection?.provider?.awareness) {
        yjsConnection.provider.awareness.setLocalState(null)
      }
    }
    
    // Handle Cmd+S / Ctrl+S
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        showNotification('All changes are saved automatically', 'info', 2000)
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('keydown', handleKeyDown)
    }
  })

  onDestroy(() => {
    fileObservers.forEach(unobserve => unobserve())
    fileObservers.clear()
    if (yjsConnection) destroyYjsConnection(yjsConnection)
    if (projectSync) projectSync.destroy()
    if (notificationTimeout) clearTimeout(notificationTimeout)
    resetAssetCache()
  })

  // Clean up deleted assets when assets array changes
  $: if (compiler && assets) {
    cleanupDeletedAssets(compiler, assets)
  }

  $: selectedYtext = selectedFile && yjsConnection?.ydoc
    ? getFileText(yjsConnection.ydoc, selectedFile.id)
    : null

  let fileObservers = new Map<number, () => void>()

  $: if (browser && yjsConnection?.ydoc && files.length > 0) {
    // Clear old observers
    fileObservers.forEach(unobserve => unobserve())
    fileObservers.clear()

    // Set up observers for all files
    files.forEach(file => {
      const ytext = getFileText(yjsConnection.ydoc, file.id)
      
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

  // Clean up observers when files change or component unmounts
  $: if (browser && files.length === 0) {
    fileObservers.forEach(unobserve => unobserve())
    fileObservers.clear()
  }

  // Trigger recompile when assets change (they may be referenced in typst files)
  $: if (browser && assets && compiler && renderer && selectedFile) {
    triggerCompile()
  }

  // Prioritize asset when both are set (asset is what user is actually viewing)
  $: selectedItem = selectedAsset || selectedFile

  // Update awareness when selected item changes - prioritize asset when viewing
  $: if (selectedAsset && yjsConnection?.provider?.awareness) {
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

  // Typst compiler and renderer
  let typst: any = null;
  let compiler: any = null;
  let renderer: any = null;
  let diagnostics: Diagnostic[] = [];
  let previewHtml: string = "";
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

  $: if (!isLoading && compiler && renderer && selectedFile && previewFileId !== null) {
    triggerCompile();
  }

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
          <button on:click={() => goto('/projects')} class="home-btn">
            <Home size={20} />
          </button>
        </Tooltip>
        <h1>{project.name}</h1>
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

    {#if notification}
      <div 
        class="notification notification-{notification.type}" 
        class:closing={notification.message.includes('__closing')}
      >
        <span>{notification.message.replace('__closing', '')}</span>
        <button class="notification-close" on:click={hideNotification}>×</button>
      </div>
    {/if}

    <div class="main">
      <ActivityBar {activePanel} onActivityClick={handleActivityClick} />
      
      {#if activePanel === 'files'}
        <FileTree
          {files}
          {assets}
          selectedItem={selectedItem}
          {previewFileId}
          onSelectFile={handleSelectFile}
          onSelectAsset={handleSelectAsset}
          onSetPreviewFile={handleSetPreviewFile}
          onDeleteFile={handleDeleteFile}
          onDeleteAsset={handleDeleteAsset}
          onCreateFile={() => showCreateFileModal = true}
          onCreateFolder={() => console.log('Create folder - to be implemented')}
          onUploadAsset={() => showUploadAssetModal = true}
          provider={yjsConnection?.provider || null}
        />
      {:else if activePanel === 'search'}
        <PlaceholderPanel title="Search" />
      {:else if activePanel === 'outline'}
        <PlaceholderPanel title="Outline" />
      {:else if activePanel === 'issues'}
        <PlaceholderPanel title="Issues and Suggestions" />
      {:else if activePanel === 'comments'}
        <PlaceholderPanel title="Comments" />
      {:else if activePanel === 'settings'}
        <PlaceholderPanel title="Settings" />
      {/if}

      {#if activePanel}
        <div class="resize-handle">
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
        currentUserColor={yjsConnection?.awareness?.getLocalState()?.color || '#3b82f6'}
        {diagnostics}
      />

      {#if activePanel}
        <div class="resize-handle">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </div>
      {/if}

      <PreviewPane
        {previewHtml}
        onDownloadPDF={handleDownloadPDF}
      />
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
    padding: 0.4rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-primary);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
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
    transition: all var(--transition-fast);
  }

  .home-btn:hover {
    color: var(--text-primary);
  }

  h1 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .notification {
    position: fixed;
    top: 1rem;
    right: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease;
  }

  .notification.closing {
    animation: slideOut 0.3s ease forwards;
  }

  @keyframes slideIn {
    from {
      transform: translateX(calc(100% + 1rem));
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(calc(100% + 1rem));
      opacity: 0;
    }
  }

  .notification-info {
    background: var(--color-info-bg);
    color: var(--color-info-text);
    border: 1px solid var(--color-info);
  }

  .notification-warning {
    background: var(--color-warning-bg);
    color: var(--color-warning-text);
    border: 1px solid var(--color-warning);
  }

  .notification-error {
    background: var(--color-error-bg);
    color: var(--color-error-text);
    border: 1px solid var(--color-error);
  }

  .notification-close {
    background: transparent;
    border: none;
    color: inherit;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
  }

  .notification-close:hover {
    opacity: 1;
  }

  .main {
    flex: 1;
    display: flex;
    overflow: hidden;
    padding-right: 16px;
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
  }

  .resize-handle svg {
    overflow: visible;
  }

  .resize-handle:hover {
    color: var(--text-secondary);
    opacity: 0.8;
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
