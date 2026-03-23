import type { File as ProjectFile, Asset, Project } from '$lib/types'
import { getWsUrl } from '$lib/utils/urls'

const WS_URL = getWsUrl()

export interface ProjectSyncCallbacks {
  onFileCreated: (file: ProjectFile) => void
  onFileUpdated: (file: ProjectFile) => void
  onFileDeleted: (fileId: string) => void
  onAssetCreated: (asset: Asset) => void
  onAssetUpdated: (asset: Asset) => void
  onAssetDeleted: (assetId: string) => void
  onProjectUpdated: (project: Project) => void
  onUnauthorized?: (event: { channel: string; code: string; reason: string }) => void
}

export function createProjectSync(projectId: string, callbacks: ProjectSyncCallbacks, token?: string | null) {
  let ws: WebSocket | null = null
  let pingInterval: number | null = null
  let reconnectTimeout: number | null = null
  let shouldReconnect = true

  function connect() {
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      return
    }

    console.log(`[ProjectSync] Connecting to project ${projectId}`)
    const wsUrl = new URL(`${WS_URL}/ws/project/${projectId}`)
    if (token) {
      wsUrl.searchParams.set('token', token)
    }
    ws = new WebSocket(wsUrl.toString())

    ws.onopen = () => {
      console.log(`[ProjectSync] Connected to project ${projectId}`)

      pingInterval = window.setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30000)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        switch (message.type) {
          case 'file_created':
            callbacks.onFileCreated(message.file)
            break
          case 'file_updated':
            callbacks.onFileUpdated(message.file)
            break
          case 'file_deleted':
            callbacks.onFileDeleted(message.file_id)
            break
          case 'asset_created':
            callbacks.onAssetCreated(message.asset)
            break
          case 'asset_updated':
            callbacks.onAssetUpdated(message.asset)
            break
          case 'asset_deleted':
            callbacks.onAssetDeleted(message.asset_id)
            break
          case 'project_updated':
            callbacks.onProjectUpdated(message.project)
            break
          case 'pong':
            break
          case 'ws_unauthorized':
            callbacks.onUnauthorized?.({
              channel: message.channel || 'project',
              code: message.code || 'insufficient_role',
              reason: message.reason || 'Unauthorized websocket operation'
            })
            break
          default:
            console.warn('[ProjectSync] Unknown message type:', message.type)
        }
      } catch (error) {
        console.error('[ProjectSync] Error parsing message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('[ProjectSync] WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('[ProjectSync] Connection closed')

      if (pingInterval) {
        clearInterval(pingInterval)
        pingInterval = null
      }

      if (shouldReconnect) {
        reconnectTimeout = window.setTimeout(() => {
          console.log('[ProjectSync] Attempting to reconnect...')
          connect()
        }, 3000)
      }
    }
  }

  connect()

  return {
    destroy: () => {
      console.log('[ProjectSync] Cleaning up')
      shouldReconnect = false

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }

      if (pingInterval) {
        clearInterval(pingInterval)
      }

      if (ws) {
        ws.close()
        ws = null
      }
    }
  }
}
