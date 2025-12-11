import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi, filesApi, assetsApi } from '../services/api'
import { useProjectYjs, getFileText } from '../hooks/useYjs'
import { useProjectSync } from '../hooks/useProjectSync'
import { CodeEditor } from '../components/CodeEditor'
import { AssetPanel } from '../components/AssetPanel'
import type { Project, File as ProjectFile, Asset } from '../types'

export const Editor: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null)
  const [showCreateFileModal, setShowCreateFileModal] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [showCollaborators, setShowCollaborators] = useState(false)
  const [showAssets, setShowAssets] = useState(false)

  // Single YJS connection for entire project (all files share this)
  // YJS handles all sync automatically - no manual save needed!
  // - IndexedDB: local offline storage
  // - WebSocket: real-time sync with server
  // - Server: persists to Redis
  const { ydoc, provider, isConnected, isSynced, isLocalSynced } = useProjectYjs(
    projectId ? Number(projectId) : undefined
  )

  // Project-level WebSocket for file system sync
  const onFileCreated = useCallback((file: ProjectFile) => {
    console.log('[Editor] File created:', file.name)
    setFiles(prev => {
      if (prev.find(f => f.id === file.id)) {
        return prev
      }
      return [...prev, file]
    })

    // Initialize YJS text for new file if we have ydoc
    if (ydoc) {
      const ytext = getFileText(ydoc, file.id)
      if (ytext && ytext.length === 0 && file.content) {
        ytext.insert(0, file.content)
      }
    }
  }, [ydoc])

  const onFileUpdated = useCallback((file: ProjectFile) => {
    console.log('[Editor] File updated:', file.name)
    setFiles(prev => prev.map(f => f.id === file.id ? file : f))
    setSelectedFile(prev => prev?.id === file.id ? file : prev)
  }, [])

  const onFileDeleted = useCallback((fileId: number) => {
    console.log('[Editor] File deleted:', fileId)
    setFiles(prev => prev.filter(f => f.id !== fileId))
    setSelectedFile(prev => {
      if (prev?.id === fileId) {
        const remaining = files.filter(f => f.id !== fileId)
        return remaining.length > 0 ? remaining[0] : null
      }
      return prev
    })
  }, [files])

  const onAssetCreated = useCallback((asset: Asset) => {
    console.log('[Editor] Asset created:', asset.filename)
    setAssets(prev => {
      if (prev.find(a => a.id === asset.id)) {
        return prev
      }
      return [...prev, asset]
    })
  }, [])

  const onAssetDeleted = useCallback((assetId: number) => {
    console.log('[Editor] Asset deleted:', assetId)
    setAssets(prev => prev.filter(a => a.id !== assetId))
  }, [])

  useProjectSync(projectId ? Number(projectId) : undefined, {
    onFileCreated,
    onFileUpdated,
    onFileDeleted,
    onAssetCreated,
    onAssetDeleted,
  })

  // Load project, files, and assets on mount
  useEffect(() => {
    if (projectId) {
      loadProject()
      loadFiles()
      loadAssets()
    }
  }, [projectId])

  // Initialize YJS text fields for all files when ydoc is ready
  useEffect(() => {
    if (!ydoc || files.length === 0) return

    console.log('[Editor] Initializing YJS text fields for', files.length, 'files')

    files.forEach(file => {
      const ytext = getFileText(ydoc, file.id)
      if (ytext && ytext.length === 0 && file.content) {
        // Only initialize if empty (avoid overwriting synced content)
        ytext.insert(0, file.content)
        console.log('[Editor] Initialized YJS text for file:', file.name)
      }
    })
  }, [ydoc, files])

  const loadProject = async () => {
    try {
      const data = await projectsApi.get(Number(projectId))
      setProject(data)
    } catch (error) {
      console.error('Failed to load project:', error)
    }
  }

  const loadFiles = async () => {
    try {
      const data = await filesApi.list(Number(projectId))
      console.log('[Editor] Loaded files:', data.length)
      setFiles(data)

      // Auto-select first file if none selected
      if (data.length > 0 && !selectedFile) {
        console.log('[Editor] Auto-selecting first file:', data[0].name)
        setSelectedFile(data[0])
      }
    } catch (error) {
      console.error('Failed to load files:', error)
    }
  }

  const loadAssets = async () => {
    try {
      const data = await assetsApi.list(Number(projectId))
      console.log('[Editor] Loaded assets:', data.length)
      setAssets(data)
    } catch (error) {
      console.error('Failed to load assets:', error)
    }
  }

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const newFile = await filesApi.create(
        Number(projectId),
        newFileName,
        `/${newFileName}`,
        'typst',
        ''
      )
      console.log('[Editor] Created file:', newFile.name)

      // Add to local state immediately
      setFiles(prev => {
        if (prev.find(f => f.id === newFile.id)) {
          return prev
        }
        return [...prev, newFile]
      })
      setSelectedFile(newFile)
      setShowCreateFileModal(false)
      setNewFileName('')
    } catch (error) {
      console.error('Failed to create file:', error)
    }
  }

  const handleSelectFile = (file: ProjectFile) => {
    console.log('[Editor] Selecting file:', file.name, '(no WebSocket reconnection)')
    setSelectedFile(file)
  }

  // Asset handlers
  const handleAssetUpload = async (file: File) => {
    const asset = await assetsApi.upload(Number(projectId), file)
    console.log('[Editor] Uploaded asset locally:', asset.filename)
    // Add to local state immediately (will also be broadcast via WebSocket)
    setAssets(prev => {
      if (prev.find(a => a.id === asset.id)) {
        return prev
      }
      return [...prev, asset]
    })
  }

  const handleAssetDelete = async (assetId: number) => {
    await assetsApi.delete(Number(projectId), assetId)
    console.log('[Editor] Deleted asset:', assetId)
  }

  const handleAssetGetUrl = async (assetId: number): Promise<string> => {
    const { url } = await assetsApi.getUrl(Number(projectId), assetId)
    return url
  }

  if (!project) {
    return <div style={styles.loading}>Loading project...</div>
  }

  // Get YJS text for selected file
  const selectedYtext = selectedFile && ydoc ? getFileText(ydoc, selectedFile.id) : null

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate('/projects')} style={styles.backButton}>
            ← Back
          </button>
          <h1 style={styles.projectName}>{project.name}</h1>
        </div>

        <div style={styles.headerCenter}>
          <div style={isConnected ? styles.statusConnected : styles.statusDisconnected}>
            {isConnected ? '🟢 Online' : '🟡 Offline'}
          </div>
          {isLocalSynced && (
            <div style={styles.statusSynced}>
              {isConnected ? (isSynced ? '✓ Synced' : '⟳ Syncing...') : '💾 Local'}
            </div>
          )}
        </div>

        <div style={styles.headerRight}>
          <button onClick={() => setShowAssets(!showAssets)} style={styles.button}>
            📎 Assets
          </button>
          <button onClick={() => setShowCollaborators(!showCollaborators)} style={styles.button}>
            👥 Collaborators
          </button>
        </div>
      </header>

      <div style={styles.main}>
        {/* Sidebar - File Explorer */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <h3>Files ({files.length})</h3>
            <button onClick={() => setShowCreateFileModal(true)} style={styles.addFileButton}>
              +
            </button>
          </div>

          <div style={styles.fileList}>
            {files.length === 0 ? (
              <div style={styles.emptyFiles}>No files yet</div>
            ) : (
              files.map((file) => (
                <div
                  key={file.id}
                  onClick={() => handleSelectFile(file)}
                  style={{
                    ...styles.fileItem,
                    ...(selectedFile?.id === file.id ? styles.fileItemActive : {}),
                  }}
                >
                  {file.name}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Editor */}
        <main style={styles.editorContainer}>
          {selectedFile && selectedYtext && provider ? (
            <div style={styles.editorWrapper}>
              <div style={styles.editorHeader}>
                <span style={styles.fileName}>{selectedFile.name}</span>
                <span style={styles.fileType}>{selectedFile.type}</span>
              </div>
              <div style={styles.editor}>
                <CodeEditor
                  ytext={selectedYtext}
                  provider={provider}
                  fileId={selectedFile.id}
                />
              </div>
            </div>
          ) : (
            <div style={styles.noFileSelected}>
              {!isConnected ? 'Connecting...' : 'Select a file or create a new one to start editing'}
            </div>
          )}
        </main>

        {/* Assets Panel */}
        {showAssets && (
          <AssetPanel
            assets={assets}
            projectId={Number(projectId)}
            onUpload={handleAssetUpload}
            onDelete={handleAssetDelete}
            onGetUrl={handleAssetGetUrl}
          />
        )}

        {/* Collaborators Panel */}
        {showCollaborators && (
          <aside style={styles.collaboratorsPanel}>
            <div style={styles.collaboratorsHeader}>
              <h3>Collaborators</h3>
              <button onClick={() => setShowCollaborators(false)} style={styles.closeButton}>
                ×
              </button>
            </div>
            <div style={styles.collaboratorsList}>
              <p style={styles.collaboratorsInfo}>
                Manage collaborators from the project settings
              </p>
              <div style={styles.onlineUsers}>
                <h4>Online Now</h4>
                {provider?.awareness && (
                  <div>
                    {Array.from(provider.awareness.getStates().entries()).map(([clientId, state]) => (
                      <div key={clientId} style={styles.onlineUser}>
                        <div
                          style={{
                            ...styles.userDot,
                            background: state.user?.color || '#999',
                          }}
                        />
                        <span>{state.user?.name || `User ${clientId}`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Create File Modal */}
      {showCreateFileModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2>Create New File</h2>
            <form onSubmit={handleCreateFile}>
              <div style={styles.field}>
                <label style={styles.label}>File Name</label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  required
                  style={styles.input}
                  placeholder="main.typ"
                />
              </div>
              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowCreateFileModal(false)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.submitButton}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#1e1e1e',
  },
  header: {
    background: '#252526',
    borderBottom: '1px solid #3e3e42',
    padding: '0.75rem 1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'white',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  headerCenter: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
  },
  headerRight: {
    display: 'flex',
    gap: '0.5rem',
  },
  backButton: {
    background: 'transparent',
    color: 'white',
    border: '1px solid #3e3e42',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  projectName: {
    fontSize: '16px',
    fontWeight: '600',
  },
  statusConnected: {
    padding: '0.25rem 0.75rem',
    borderRadius: '4px',
    background: '#1a4d2e',
    color: '#4ade80',
    fontSize: '12px',
  },
  statusDisconnected: {
    padding: '0.25rem 0.75rem',
    borderRadius: '4px',
    background: '#4d1a1a',
    color: '#f87171',
    fontSize: '12px',
  },
  statusSynced: {
    padding: '0.25rem 0.75rem',
    borderRadius: '4px',
    background: '#1e3a8a',
    color: '#60a5fa',
    fontSize: '12px',
  },
  statusSaving: {
    padding: '0.25rem 0.75rem',
    borderRadius: '4px',
    background: '#854d0e',
    color: '#fbbf24',
    fontSize: '12px',
  },
  statusSaved: {
    padding: '0.25rem 0.75rem',
    borderRadius: '4px',
    background: '#1e3a8a',
    color: '#60a5fa',
    fontSize: '12px',
  },
  button: {
    background: '#0e639c',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  sidebar: {
    width: '250px',
    background: '#252526',
    borderRight: '1px solid #3e3e42',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  sidebarHeader: {
    padding: '1rem',
    borderBottom: '1px solid #3e3e42',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'white',
  },
  addFileButton: {
    background: '#0e639c',
    color: 'white',
    border: 'none',
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '18px',
  },
  fileList: {
    flex: 1,
    overflow: 'auto',
  },
  emptyFiles: {
    padding: '2rem 1rem',
    textAlign: 'center' as const,
    color: '#888',
    fontSize: '14px',
  },
  fileItem: {
    padding: '0.75rem 1rem',
    color: '#ccc',
    cursor: 'pointer',
    fontSize: '14px',
    borderLeft: '3px solid transparent',
  },
  fileItemActive: {
    background: '#2a2d2e',
    color: 'white',
    borderLeft: '3px solid #0e639c',
  },
  editorContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  editorWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  editorHeader: {
    background: '#252526',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #3e3e42',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileName: {
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
  },
  fileType: {
    color: '#888',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
  },
  editor: {
    flex: 1,
    overflow: 'auto',
  },
  noFileSelected: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#888',
    fontSize: '16px',
  },
  collaboratorsPanel: {
    width: '300px',
    background: '#252526',
    borderLeft: '1px solid #3e3e42',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  collaboratorsHeader: {
    padding: '1rem',
    borderBottom: '1px solid #3e3e42',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'white',
  },
  closeButton: {
    background: 'transparent',
    color: 'white',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
  },
  collaboratorsList: {
    flex: 1,
    padding: '1rem',
    color: 'white',
  },
  collaboratorsInfo: {
    color: '#888',
    fontSize: '14px',
    marginBottom: '1rem',
  },
  onlineUsers: {
    marginTop: '1rem',
  },
  onlineUser: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem',
    fontSize: '14px',
  },
  userDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  loading: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    color: '#666',
  },
  modal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  modalContent: {
    background: '#252526',
    padding: '2rem',
    borderRadius: '8px',
    width: '100%',
    maxWidth: '400px',
    color: 'white',
  },
  field: {
    marginBottom: '1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #3e3e42',
    borderRadius: '4px',
    fontSize: '14px',
    background: '#1e1e1e',
    color: 'white',
  },
  modalActions: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1.5rem',
  },
  cancelButton: {
    flex: 1,
    background: '#3e3e42',
    color: 'white',
    border: 'none',
    padding: '0.75rem',
    borderRadius: '4px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  submitButton: {
    flex: 1,
    background: '#0e639c',
    color: 'white',
    border: 'none',
    padding: '0.75rem',
    borderRadius: '4px',
    fontWeight: '600',
    cursor: 'pointer',
  },
}
