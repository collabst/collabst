import { browser } from '$app/environment'

/**
 * Utility functions to generate dynamic API and WebSocket URLs
 * based on the current browser hostname instead of hardcoding
 */

/**
 * Get the base API URL using the current hostname with port from env
 * Uses http/https based on current protocol
 */
export const getApiUrl = (): string => {
    return `${import.meta.env.VITE_API_URL}`
}

/**
 * Get the WebSocket URL using the current hostname with port from env
 * Automatically converts http -> ws and https -> wss
 */
export const getWsUrl = (): string => {
  const apiUrl = new URL(import.meta.env.VITE_API_URL)
  const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  console.log(`${wsProtocol}//${apiUrl.hostname}`)
  const port = apiUrl.port ? `:${apiUrl.port}` : ''
  return `${wsProtocol}//${apiUrl.host}${apiUrl.pathname}`
}
