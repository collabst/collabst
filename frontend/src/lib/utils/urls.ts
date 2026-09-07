/** API and WebSocket URLs derived from the current hostname rather than hardcoded. */

/** The base API URL: current hostname, port from env, protocol from the page. */
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

/** Same as `getApiUrl`, with http -> ws and https -> wss. */
export function getWsUrl() {
  const configuredApiUrl = getApiUrl()
  const apiUrl = configuredApiUrl.startsWith('http://') || configuredApiUrl.startsWith('https://')
    ? new URL(configuredApiUrl)
    : new URL(configuredApiUrl, window.location.origin)

  const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${apiUrl.host}${apiUrl.pathname}`
}
