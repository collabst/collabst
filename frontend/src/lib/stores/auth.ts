import { writable, derived } from 'svelte/store'
import { browser } from '$app/environment'
import { authApi } from '$lib/services/api'
import type { User, AuthResponse } from '$lib/types'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
}

const createAuthStore = () => {
  // Load token, refresh token, and user from localStorage
  const storedToken = browser ? localStorage.getItem('token') : null
  const storedRefreshToken = browser ? localStorage.getItem('refreshToken') : null
  const storedUser = browser ? localStorage.getItem('user') : null

  const { subscribe, set, update } = writable<AuthState>({
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken,
    refreshToken: storedRefreshToken
  })

  return {
    subscribe,
    login: async (email: string, password: string) => {
      const response: AuthResponse = await authApi.login(email, password)
      const token = response.access_token
      const refreshToken = response.refresh_token
      const user = response.user

      if (browser) {
        localStorage.setItem('token', token)
        localStorage.setItem('refreshToken', refreshToken)
        localStorage.setItem('user', JSON.stringify(user))
      }

      update(state => ({ ...state, token, refreshToken, user }))
    },
    register: async (email: string, displayName: string, password: string) => {
      const newUser = await authApi.register(email, displayName, password)
      const response: AuthResponse = await authApi.login(email, password)
      const token = response.access_token
      const refreshToken = response.refresh_token
      const user = response.user

      if (browser) {
        localStorage.setItem('token', token)
        localStorage.setItem('refreshToken', refreshToken)
        localStorage.setItem('user', JSON.stringify(user))
      }

      update(state => ({ ...state, token, refreshToken, user }))
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
      }
      set({ user: null, token: null, refreshToken: null })
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
    }
  }
}

export const auth = createAuthStore()
export const isAuthenticated = derived(auth, $auth => !!$auth.token)
