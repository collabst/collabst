<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { browser } from '$app/environment'
  import { projectsApi, filesApi, assetsApi } from '$lib/services/api'
  import { createProjectYjs, destroyYjsConnection, getFileText } from '$lib/yjs'
  import { createProjectSync } from '$lib/projectSync'
  import { auth } from '$lib/stores/auth'
  import FileTree from '$lib/components/editor/FileTree.svelte'
  import EditorPane from '$lib/components/editor/EditorPane.svelte'
  import CreateFileModal from '$lib/components/editor/CreateFileModal.svelte'
  import UploadAssetModal from '$lib/components/editor/UploadAssetModal.svelte'
  import CollaboratorsPanel from '$lib/components/editor/CollaboratorsPanel.svelte'
  import UserPresence from '$lib/components/editor/UserPresence.svelte'
  import type { Project, File as ProjectFile, Asset } from '$lib/types'
  import type { YjsConnection } from '$lib/yjs'

  $: projectId = $page.params.projectId

  let project: Project | null = null
  let files: ProjectFile[] = []
  let assets: Asset[] = []
  let selectedFile: ProjectFile | null = null
  let selectedAsset: Asset | null = null
  let showCreateFileModal = false
  let showUploadAssetModal = false
  let showCollaborators = false

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
        selectedFile = data[0]
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
  }

  function handleSelectAsset(asset: Asset) {
    selectedAsset = asset
    selectedFile = null
  }

  async function handleDeleteFile(fileId: number) {
    if (!confirm('Delete this file?')) return
    try {
      await filesApi.delete(Number(projectId), fileId)
      files = files.filter(f => f.id !== fileId)
      if (selectedFile?.id === fileId) {
        selectedFile = files[0] || null
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
    }
  }

  async function handleDeleteAsset(assetId: number) {
    if (!confirm('Delete this asset?')) return
    try {
      await assetsApi.delete(Number(projectId), assetId)
      assets = assets.filter(a => a.id !== assetId)
      if (selectedAsset?.id === assetId) {
        selectedAsset = null
      }
    } catch (error) {
      console.error('Failed to delete asset:', error)
    }
  }

  async function handleGetAssetUrl(assetId: number): Promise<string> {
    const { url } = await assetsApi.getUrl(Number(projectId), assetId)
    return url
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
    if (yjsConnection) destroyYjsConnection(yjsConnection)
    if (projectSync) projectSync.destroy()
    if (notificationTimeout) clearTimeout(notificationTimeout)
  })

  $: selectedYtext = selectedFile && yjsConnection?.ydoc
    ? getFileText(yjsConnection.ydoc, selectedFile.id)
    : null

  $: if (yjsConnection?.ydoc && files.length > 0) {
    files.forEach(file => {
      const ytext = getFileText(yjsConnection.ydoc, file.id)
      if (ytext && ytext.length === 0 && file.content) {
        ytext.insert(0, file.content)
      }
    })
  }

  $: selectedItem = selectedFile || selectedAsset
</script>

{#if !project}
  <div class="loading">Loading project...</div>
{:else}
  <div class="container">
    <header>
      <div class="header-left">
        <button on:click={() => goto('/projects')} class="back-btn">
          ← Back
        </button>
        <h1>{project.name}</h1>
      </div>

      <div class="header-rightr">
        <UserPresence provider={yjsConnection?.provider || null} />
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
      <FileTree
        {files}
        {assets}
        selectedItem={selectedItem}
        onSelectFile={handleSelectFile}
        onSelectAsset={handleSelectAsset}
        onDeleteFile={handleDeleteFile}
        onDeleteAsset={handleDeleteAsset}
        onCreateFile={() => showCreateFileModal = true}
        onUploadAsset={() => showUploadAssetModal = true}
      />

      <EditorPane
        {selectedFile}
        {selectedAsset}
        ytext={selectedYtext}
        provider={yjsConnection?.provider || null}
        {isConnected}
        onGetAssetUrl={handleGetAssetUrl}
      />
    </div>

    <CreateFileModal
      show={showCreateFileModal}
      onClose={() => showCreateFileModal = false}
      onSubmit={handleCreateFile}
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
    background: #1e1e1e;
  }

  header {
    background: #252526;
    border-bottom: 1px solid #3e3e42;
    padding: 0.75rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: white;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .back-btn {
    background: transparent;
    color: white;
    border: 1px solid #3e3e42;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .back-btn:hover {
    background: #3e3e42;
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
    background: #1e3a8a;
    color: #93c5fd;
    border: 1px solid #3b82f6;
  }

  .notification-warning {
    background: #78350f;
    color: #fbbf24;
    border: 1px solid #f59e0b;
  }

  .notification-error {
    background: #7f1d1d;
    color: #fca5a5;
    border: 1px solid #ef4444;
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
  }

  .loading {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: #666;
  }
</style>
