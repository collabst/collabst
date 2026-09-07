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
  user?: User | null,
  token?: string | null
): YjsConnection {
  const ydoc = new Y.Doc()

  const indexeddb = new IndexeddbPersistence(`project-${projectId}`, ydoc)
  let isLocalSynced = false

  indexeddb.on('synced', () => {
    isLocalSynced = true
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

    if (isConnected) {
      setTimeout(() => {
        isSynced = true
      }, 500)
    } else {
      isSynced = false
    }

  }

  const handleSync = (synced: boolean) => {
    isSynced = synced
  }

  // A joining client triggers an awareness update, which is our cue to
  // re-broadcast our own presence so it sees us.
  const handleAwarenessChange = ({ added, updated, removed }: { added: number[], updated: number[], removed: number[] }) => {
    if (added.length > 0 && user) {
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
