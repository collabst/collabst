import { useEffect, useRef } from 'react'
import type { File as ProjectFile, Asset } from '../types'
import { getWsUrl } from '../utils/urls'

const WS_URL = getWsUrl()

interface ProjectSyncCallbacks {
  onFileCreated: (file: ProjectFile) => void
  onFileUpdated: (file: ProjectFile) => void
  onFileDeleted: (fileId: number) => void
  onAssetCreated: (asset: Asset) => void
  onAssetDeleted: (assetId: number) => void
}

/**
 * Hook to sync file system changes across all users in a project via WebSocket
 */
export const useProjectSync = (projectId: number | undefined, callbacks: ProjectSyncCallbacks) => {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)

  // Store callbacks in ref to avoid reconnecting when they change
  const callbacksRef = useRef(callbacks)
  
  // Update callbacks ref when they change (without reconnecting)
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  useEffect(() => {
    if (!projectId) return

    isMountedRef.current = true

    const connect = () => {
      // Don't connect if already connected or connecting
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        return
      }

      console.log(`[ProjectSync] Connecting to project ${projectId}`)

      const ws = new WebSocket(`${WS_URL}/ws/project/${projectId}`)
      wsRef.current = ws

      let pingInterval: number | null = null

      ws.onopen = () => {
        console.log(`[ProjectSync] Connected to project ${projectId}`)

        // Send ping every 30 seconds to keep connection alive
        pingInterval = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          switch (message.type) {
            case 'file_created':
              callbacksRef.current.onFileCreated(message.file)
              break
            case 'file_updated':
              callbacksRef.current.onFileUpdated(message.file)
              break
            case 'file_deleted':
              callbacksRef.current.onFileDeleted(message.file_id)
              break
            case 'asset_created':
              callbacksRef.current.onAssetCreated(message.asset)
              break
            case 'asset_deleted':
              callbacksRef.current.onAssetDeleted(message.asset_id)
              break
            case 'pong':
              // Keep-alive response - silent
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
        }
        
        // Only attempt to reconnect if component is still mounted
        if (isMountedRef.current && wsRef.current === ws) {
          wsRef.current = null
          reconnectTimeoutRef.current = window.setTimeout(() => {
            console.log('[ProjectSync] Attempting to reconnect...')
            connect()
          }, 3000)
        }
      }
    }

    connect()

    return () => {
      console.log('[ProjectSync] Cleaning up')
      isMountedRef.current = false
      
      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [projectId]) // Only depends on projectId

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  }
}
