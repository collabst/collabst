import { getWsUrl } from '$lib/utils/urls'
import type { CommentNotificationMessage } from '$lib/types'

const WS_URL = getWsUrl()

export interface CommentSyncCallbacks {
  onThreadCreated: (message: CommentNotificationMessage) => void
  onThreadUpdated: (message: CommentNotificationMessage) => void
  onReplyCreated: (message: CommentNotificationMessage) => void
  onPermissionChanged?: (message: CommentNotificationMessage) => void
  onConnected?: (context: { reconnected: boolean }) => void
  onUnauthorized?: (event: { channel: string; code: string; reason: string }) => void
}

export function createCommentSync(projectId: string, callbacks: CommentSyncCallbacks, token?: string | null) {
  let ws: WebSocket | null = null
  let pingInterval: number | null = null
  let reconnectTimeout: number | null = null
  let shouldReconnect = true
  let hasConnected = false

  function connect() {
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      return
    }

    console.log(`[CommentSync] Connecting to project ${projectId}`)
    const wsUrl = new URL(`${WS_URL}/ws/notifications/project/${projectId}`)
    if (token) {
      wsUrl.searchParams.set('token', token)
    }
    ws = new WebSocket(wsUrl.toString())

    ws.onopen = () => {
      console.log(`[CommentSync] Connected to project ${projectId}`)
      callbacks.onConnected?.({ reconnected: hasConnected })
      hasConnected = true

      pingInterval = window.setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30000)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as CommentNotificationMessage | { type: string; channel?: string; code?: string; reason?: string }

        switch (message.type) {
          case 'comment_thread_created':
            callbacks.onThreadCreated(message as CommentNotificationMessage)
            break
          case 'comment_thread_updated':
            callbacks.onThreadUpdated(message as CommentNotificationMessage)
            break
          case 'comment_reply_created':
            callbacks.onReplyCreated(message as CommentNotificationMessage)
            break
          case 'permission_changed':
            callbacks.onPermissionChanged?.(message as CommentNotificationMessage)
            break
          case 'pong':
            break
          case 'ws_unauthorized':
            callbacks.onUnauthorized?.({
              channel: message.channel || 'notifications',
              code: message.code || 'insufficient_role',
              reason: message.reason || 'Unauthorized websocket operation',
            })
            break
          default:
            break
        }
      } catch (error) {
        console.error('[CommentSync] Error parsing message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('[CommentSync] WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('[CommentSync] Connection closed')

      if (pingInterval) {
        clearInterval(pingInterval)
        pingInterval = null
      }

      if (shouldReconnect) {
        reconnectTimeout = window.setTimeout(() => {
          console.log('[CommentSync] Attempting to reconnect...')
          connect()
        }, 3000)
      }
    }
  }

  connect()

  return {
    destroy: () => {
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
    },
  }
}
