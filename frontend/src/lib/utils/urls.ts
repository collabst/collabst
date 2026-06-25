/**
 * Utility functions to generate dynamic API and WebSocket URLs
 * based on the current browser hostname instead of hardcoding
 */

/**
 * Get the base API URL using the current hostname with port from env
 * Uses http/https based on current protocol
 */
export function getApiUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL
  if (!configuredUrl) {
    return '/api/v1'
  }
  return `${configuredUrl}`
}

export function getProfilePicUrl(userId: string) {
  const apiUrl = getApiUrl().replace(/\/$/, '')
  return `${apiUrl}/profile-pic/${userId}`
}

/**
 * Get the WebSocket URL using the current hostname with port from env
 * Automatically converts http -> ws and https -> wss
 */
export function getWsUrl() {
  const configuredApiUrl = getApiUrl()
  const apiUrl = configuredApiUrl.startsWith('http://') || configuredApiUrl.startsWith('https://')
    ? new URL(configuredApiUrl)
    : new URL(configuredApiUrl, window.location.origin)

  const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${apiUrl.host}${apiUrl.pathname}`
}
