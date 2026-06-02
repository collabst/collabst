import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { getWsUrl } from '$lib/utils/urls'
import type { User } from '$lib/types'

const WS_URL = getWsUrl()

export interface YjsConnection {
  ydoc: Y.Doc
  provider: WebsocketProvider
  indexeddb: IndexeddbPersistence
  isConnected: boolean
  isSynced: boolean
  isLocalSynced: boolean
}

// Generate a random color for user avatar
function generateUserColor(): string {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

export function createProjectYjs(
  projectId: string,
  onStatusChange: (status: { isConnected: boolean; isSynced: boolean; isLocalSynced: boolean }) => void,
  user?: User | null,
  token?: string | null
): YjsConnection {
  console.log('[YJS] Creating project-wide connection for project:', projectId)

  const ydoc = new Y.Doc()

  const indexeddb = new IndexeddbPersistence(`project-${projectId}`, ydoc)
  let isLocalSynced = false

  indexeddb.on('synced', () => {
    console.log('[YJS] IndexedDB synced - local data loaded')
    isLocalSynced = true
    onStatusChange({ isConnected, isSynced, isLocalSynced })
  })

  const provider = new WebsocketProvider(
    `${WS_URL}/ws`,
    `project-${projectId}`,
    ydoc,
    {
      connect: true,
      params: token ? { token } : {},
    }
  )

  // Set user awareness state for presence
  console.log('[YJS] Setting local user awareness state:', user)
  if (user) {
    provider.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.display_name,
      user_type: user.user_type,
      color: generateUserColor(),
    })
  }

  let isConnected = false
  let isSynced = false

  const handleStatus = (event: { status: string }) => {
    isConnected = event.status === 'connected'
    console.log('[YJS] WebSocket status:', event.status)

    if (isConnected) {
      setTimeout(() => {
        isSynced = true
        onStatusChange({ isConnected, isSynced, isLocalSynced })
      }, 500)
    } else {
      isSynced = false
    }

    onStatusChange({ isConnected, isSynced, isLocalSynced })
  }

  const handleSync = (synced: boolean) => {
    console.log('[YJS] Server sync status:', synced)
    isSynced = synced
    onStatusChange({ isConnected, isSynced, isLocalSynced })
  }

  // Listen for awareness changes from other clients
  // When a new client joins, they trigger an awareness update, so we re-broadcast ours
  const handleAwarenessChange = ({ added, updated, removed }: { added: number[], updated: number[], removed: number[] }) => {
    if (added.length > 0 && user) {
      // New client(s) joined, re-broadcast our presence so they see us
      console.log('[YJS] New client(s) detected, re-broadcasting awareness')
      provider.awareness.setLocalStateField('user', {
        id: user.id,
        name: user.display_name,
        user_type: user.user_type,
        color: provider.awareness.getLocalState()?.user?.color || generateUserColor(),
      })
    }
  }

  provider.awareness.on('change', handleAwarenessChange)
  provider.on('status', handleStatus)
  provider.on('sync', handleSync)

  return {
    ydoc,
    provider,
    indexeddb,
    isConnected,
    isSynced,
    isLocalSynced,
  }
}

export function destroyYjsConnection(connection: YjsConnection) {
  console.log('[YJS] Cleaning up project connection')
  connection.provider.destroy()
  connection.indexeddb.destroy()
  connection.ydoc.destroy()
}

export function getFileText(ydoc: Y.Doc | null, fileId: string): Y.Text | null {
  if (!ydoc) return null
  return ydoc.getText(`file-${fileId}`)
}
