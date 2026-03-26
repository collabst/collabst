import { writable, derived } from 'svelte/store'
import { browser } from '$app/environment'
import { authApi } from '$lib/services/api'
import type { User, AuthResponse } from '$lib/types'

interface GuestAccessContext {
  projectId: string
  permission: 'read' | 'comment' | 'edit'
  shareHash: string
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  guestAccess: GuestAccessContext | null
}

const normalizeUser = (user: User): User => {
  if (!('user_type' in user) || !user.user_type) {
    return {
      ...user,
      user_type: 'auth'
    }
  }
  return user
}

const createAuthStore = () => {
  // Load token, refresh token, and user from localStorage
  const storedToken = browser ? localStorage.getItem('token') : null
  const storedRefreshToken = browser ? localStorage.getItem('refreshToken') : null
  const storedUser = browser ? localStorage.getItem('user') : null
  const storedGuestAccess = browser ? localStorage.getItem('guestAccess') : null

  const { subscribe, set, update } = writable<AuthState>({
    user: storedUser ? normalizeUser(JSON.parse(storedUser) as User) : null,
    token: storedToken,
    refreshToken: storedRefreshToken,
    guestAccess: storedGuestAccess ? JSON.parse(storedGuestAccess) : null
  })

  return {
    subscribe,
    login: async (email: string, password: string) => {
      const response: AuthResponse = await authApi.login(email, password)
      const token = response.access_token
      const refreshToken = response.refresh_token
      const user = normalizeUser(response.user)

      if (browser) {
        localStorage.setItem('token', token)
        localStorage.setItem('refreshToken', refreshToken)
        localStorage.setItem('user', JSON.stringify(user))
        localStorage.removeItem('guestAccess')
      }

      update(state => ({ ...state, token, refreshToken, user, guestAccess: null }))
    },
    register: async (email: string, displayName: string, password: string) => {
      const newUser = await authApi.register(email, displayName, password)
      const response: AuthResponse = await authApi.login(email, password)
      const token = response.access_token
      const refreshToken = response.refresh_token
      const user = normalizeUser(response.user)

      if (browser) {
        localStorage.setItem('token', token)
        localStorage.setItem('refreshToken', refreshToken)
        localStorage.setItem('user', JSON.stringify(user))
        localStorage.removeItem('guestAccess')
      }

      update(state => ({ ...state, token, refreshToken, user, guestAccess: null }))
    },
    logout: async () => {
      const refreshToken = browser ? localStorage.getItem('refreshToken') : null

      // Call logout API to revoke refresh token
      if (refreshToken) {
        try {
          await authApi.logout(refreshToken)
        } catch (error) {
          console.error('Error revoking refresh token:', error)
        }
      }

      if (browser) {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
        localStorage.removeItem('guestAccess')
      }
      set({ user: null, token: null, refreshToken: null, guestAccess: null })
    },
    setUser: (user: User | null) => {
      if (browser && user) {
        localStorage.setItem('user', JSON.stringify(user))
      }
      update(state => ({ ...state, user }))
    },
    setTokens: (token: string, refreshToken: string) => {
      if (browser) {
        localStorage.setItem('token', token)
        localStorage.setItem('refreshToken', refreshToken)
      }
      update(state => ({ ...state, token, refreshToken }))
    },
    setGuestSession: (
      guestAccess: GuestAccessContext,
      payload?: { token?: string | null; refreshToken?: string | null; user?: User | null }
    ) => {
      const token = payload?.token ?? null
      const refreshToken = payload?.refreshToken ?? null
      const user = payload?.user ? normalizeUser(payload.user) : null

      if (browser) {
        localStorage.setItem('guestAccess', JSON.stringify(guestAccess))
        if (token) {
          localStorage.setItem('token', token)
        }
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken)
        }
        if (user) {
          localStorage.setItem('user', JSON.stringify(user))
        }
      }

      update(state => ({
        ...state,
        guestAccess,
        token: token ?? state.token,
        refreshToken: refreshToken ?? state.refreshToken,
        user: user ?? state.user,
      }))
    },
    clearGuestSession: () => {
      if (browser) {
        localStorage.removeItem('guestAccess')
      }
      update(state => ({ ...state, guestAccess: null }))
    }
  }
}

export const auth = createAuthStore()
export const isAuthenticated = derived(auth, $auth => !!$auth.token)
export const hasWorkspaceSession = derived(auth, $auth => !!$auth.token || !!$auth.guestAccess)
