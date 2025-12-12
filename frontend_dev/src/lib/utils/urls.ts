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
  // Default for SSR
  if (!browser) {
    return `http://localhost:${import.meta.env.VITE_API_PORT || '8000'}`
  }

  // Use current browser protocol and hostname with port from env
  const protocol = window.location.protocol // 'http:' or 'https:'
  const hostname = window.location.hostname // just hostname without port
  const port = import.meta.env.VITE_API_PORT || '8000'

  return `${protocol}//${hostname}:${port}`
}

/**
 * Get the WebSocket URL using the current hostname with port from env
 * Automatically converts http -> ws and https -> wss
 */
export const getWsUrl = (): string => {
  // Default for SSR
  if (!browser) {
    return `ws://localhost:${import.meta.env.VITE_API_PORT || '8000'}`
  }

  // Use current browser protocol and hostname with port from env
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const hostname = window.location.hostname // just hostname without port
  const port = import.meta.env.VITE_API_PORT || '8000'

  return `${protocol}//${hostname}:${port}`
}
