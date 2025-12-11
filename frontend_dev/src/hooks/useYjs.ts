import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { getWsUrl } from '../utils/urls'

const WS_URL = getWsUrl()

/**
 * Hook to create a single YJS document for an entire project.
 * All files in the project share the same YJS document and WebSocket connection.
 * Each file's content is stored in a separate Y.Text field named by file ID.
 * 
 * Persistence strategy:
 * 1. IndexedDB (y-indexeddb): Local offline storage - syncs automatically on reconnect
 * 2. WebSocket (y-websocket): Real-time sync with backend
 * 3. Backend persists YJS state to Redis/PostgreSQL
 * 
 * The frontend does NOT need to explicitly "save" - YJS handles sync automatically!
 */
export const useProjectYjs = (projectId: number | undefined) => {
  const [isConnected, setIsConnected] = useState(false)
  const [isSynced, setIsSynced] = useState(false)
  const [isLocalSynced, setIsLocalSynced] = useState(false)

  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const indexeddbRef = useRef<IndexeddbPersistence | null>(null)

  useEffect(() => {
    if (!projectId) return

    console.log('[YJS] Creating project-wide connection for project:', projectId)

    // Create ONE YJS document for the entire project
    const ydoc = new Y.Doc()
    ydocRef.current = ydoc

    // 1. IndexedDB persistence for offline support
    // This loads cached state immediately and syncs changes locally
    const indexeddbProvider = new IndexeddbPersistence(`project-${projectId}`, ydoc)
    indexeddbRef.current = indexeddbProvider

    indexeddbProvider.on('synced', () => {
      console.log('[YJS] IndexedDB synced - local data loaded')
      setIsLocalSynced(true)
    })

    // 2. WebSocket provider for real-time collaboration
    // y-websocket automatically:
    // - Reconnects on disconnect
    // - Syncs state on reconnection (CRDT merge)
    // - Handles offline -> online transitions
    const provider = new WebsocketProvider(
      `${WS_URL}/ws`,
      `project-${projectId}`,
      ydoc,
      {
        // Reconnect configuration
        connect: true,
        // WebSocket will automatically reconnect
        // and sync state when connection is restored
      }
    )
    providerRef.current = provider

    // Listen for connection status
    const handleStatus = (event: { status: string }) => {
      const connected = event.status === 'connected'
      console.log('[YJS] WebSocket status:', event.status)
      setIsConnected(connected)
      
      // When connected, we're effectively synced after a short delay
      // (y-websocket sync event only fires if server sends data back)
      if (connected) {
        // Give time for sync message exchange, then consider synced
        setTimeout(() => {
          setIsSynced(true)
        }, 500)
      } else {
        setIsSynced(false)
      }
    }

    // Listen for sync status (synced with server)
    const handleSync = (synced: boolean) => {
      console.log('[YJS] Server sync status:', synced)
      setIsSynced(synced)
    }

    provider.on('status', handleStatus)
    provider.on('sync', handleSync)

    // Cleanup only on unmount or project change
    return () => {
      console.log('[YJS] Cleaning up project connection')
      provider.off('status', handleStatus)
      provider.off('sync', handleSync)
      provider.destroy()
      indexeddbProvider.destroy()
      ydoc.destroy()
    }
  }, [projectId])

  return {
    ydoc: ydocRef.current,
    provider: providerRef.current,
    isConnected,
    isSynced,         // Synced with server
    isLocalSynced,    // Synced with IndexedDB (offline cache loaded)
  }
}

/**
 * Get a Y.Text field for a specific file within the project's YJS document.
 * Multiple files can be edited simultaneously without disconnecting.
 */
export const getFileText = (ydoc: Y.Doc | null, fileId: number): Y.Text | null => {
  if (!ydoc) return null
  return ydoc.getText(`file-${fileId}`)
}
