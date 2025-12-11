/**
 * Utility functions to generate dynamic API and WebSocket URLs
 * based on the current browser hostname instead of hardcoding
 */

/**
 * Get the base API URL using the current hostname
 * Uses http/https based on current protocol
 */
export const getApiUrl = (): string => {
  // In development, allow override via env variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  // Use current browser protocol and hostname
  const protocol = window.location.protocol // 'http:' or 'https:'
  const host = window.location.host // hostname:port

  return `${protocol}//${host}`
}

/**
 * Get the WebSocket URL using the current hostname
 * Automatically converts http -> ws and https -> wss
 */
export const getWsUrl = (): string => {
  // In development, allow override via env variable
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL
  }

  // Use current browser protocol and hostname
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host // hostname:port

  return `${protocol}//${host}`
}
