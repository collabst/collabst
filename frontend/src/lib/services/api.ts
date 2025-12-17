import axios from 'axios'
import type { User, Project, File, Asset, AuthResponse, Collaborator, Invitation } from '../types'
import { getApiUrl } from '../utils/urls'

const API_URL = getApiUrl()

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle token refresh on 401 errors
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => {
          return api(originalRequest)
        }).catch(err => {
          return Promise.reject(err)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refreshToken')

      if (!refreshToken) {
        // No refresh token, clear storage and reject
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
        return Promise.reject(error)
      }

      try {
        // Call refresh endpoint
        const formData = new URLSearchParams()
        formData.append('refresh_token', refreshToken)

        const { data } = await api.post<AuthResponse>('/auth/refresh', formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          _retry: true // Mark this request to avoid infinite loop
        } as any)

        const newAccessToken = data.access_token
        const newRefreshToken = data.refresh_token

        // Update tokens in localStorage
        localStorage.setItem('token', newAccessToken)
        localStorage.setItem('refreshToken', newRefreshToken)

        // Update the authorization header
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`

        // Process queued requests
        processQueue(null, newAccessToken)

        // Retry original request
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh failed, clear storage and logout
        processQueue(refreshError as Error, null)
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')

        // Redirect to login (optional - depends on your app structure)
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }

        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  register: async (email: string, username: string, password: string): Promise<User> => {
    const { data } = await api.post<User>('/auth/register', { email, username, password })
    return data
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const formData = new URLSearchParams()
    formData.append('email', email)
    formData.append('password', password)

    const { data } = await api.post<AuthResponse>('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    return data
  },

  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const formData = new URLSearchParams()
    formData.append('refresh_token', refreshToken)

    const { data } = await api.post<AuthResponse>('/auth/refresh', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    return data
  },

  logout: async (refreshToken: string): Promise<void> => {
    const formData = new URLSearchParams()
    formData.append('refresh_token', refreshToken)

    await api.post('/auth/logout', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
  },
}

// Projects
export const projectsApi = {
  list: async (): Promise<Project[]> => {
    const { data } = await api.get<Project[]>('/projects')
    return data
  },

  get: async (id: number): Promise<Project> => {
    const { data } = await api.get<Project>(`/projects/${id}`)
    return data
  },

  create: async (name: string, description?: string): Promise<Project> => {
    const { data } = await api.post<Project>('/projects', { name, description })
    return data
  },

  update: async (id: number, name?: string, description?: string): Promise<Project> => {
    const { data } = await api.put<Project>(`/projects/${id}`, { name, description })
    return data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/projects/${id}`)
  },

  // Collaborators
  listCollaborators: async (projectId: number): Promise<Collaborator[]> => {
    const { data } = await api.get<Collaborator[]>(`/projects/${projectId}/collaborators`)
    return data
  },

  addCollaborator: async (projectId: number, userId: number, role: 'reader' | 'editor' | 'admin'): Promise<Collaborator> => {
    const { data } = await api.post<Collaborator>(`/projects/${projectId}/collaborators`, { user_id: userId, role })
    return data
  },

  updateCollaborator: async (projectId: number, userId: number, role: 'reader' | 'editor' | 'admin'): Promise<Collaborator> => {
    const { data } = await api.put<Collaborator>(`/projects/${projectId}/collaborators/${userId}`, { role })
    return data
  },

  removeCollaborator: async (projectId: number, userId: number): Promise<void> => {
    await api.delete(`/projects/${projectId}/collaborators/${userId}`)
  },
}

// Files
export const filesApi = {
  list: async (projectId: number): Promise<File[]> => {
    const { data } = await api.get<File[]>(`/projects/${projectId}/files`)
    return data
  },

  create: async (
    projectId: number,
    name: string,
    path: string,
    type: File['type'],
    content: string,
    parentId: number | null = null
  ): Promise<File> => {
    const { data } = await api.post<File>(`/projects/${projectId}/files`, {
      project_id: projectId,
      name,
      path,
      type,
      content,
      parent_id: parentId,
      is_folder: false,
    })
    return data
  },

  createFolder: async (
    projectId: number,
    name: string,
    parentId: number | null = null
  ): Promise<File> => {
    const { data } = await api.post<File>(`/projects/${projectId}/files`, {
      project_id: projectId,
      name,
      path: '/',  // Will be computed by backend
      type: 'other',
      content: '',
      parent_id: parentId,
      is_folder: true,
    })
    return data
  },

  update: async (
    projectId: number,
    fileId: number,
    updates: { name?: string; content?: string; path?: string; parent_id?: number | null }
  ): Promise<File> => {
    const { data } = await api.put<File>(`/projects/${projectId}/files/${fileId}`, updates)
    return data
  },

  move: async (
    projectId: number,
    fileId: number,
    newParentId: number | null
  ): Promise<File> => {
    const { data } = await api.put<File>(`/projects/${projectId}/files/${fileId}`, {
      parent_id: newParentId
    })
    return data
  },

  delete: async (projectId: number, fileId: number): Promise<void> => {
    await api.delete(`/projects/${projectId}/files/${fileId}`)
  },
}

// Assets
export const assetsApi = {
  list: async (projectId: number): Promise<Asset[]> => {
    const { data } = await api.get<Asset[]>(`/projects/${projectId}/assets`)
    return data
  },

  upload: async (projectId: number, file: globalThis.File, parentId: number | null = null): Promise<Asset> => {
    const formData = new FormData()
    formData.append('file', file as unknown as Blob)
    if (parentId !== null) {
      formData.append('parent_id', parentId.toString())
    }

    const { data } = await api.post<Asset>(`/projects/${projectId}/assets/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return data
  },

  getUrl: async (projectId: number, assetId: number): Promise<{ url: string; filename: string; mime_type: string }> => {
    const { data } = await api.get(`/projects/${projectId}/assets/${assetId}/url`)
    return data
  },

  update: async (projectId: number, assetId: number, updates: { filename?: string; parent_id?: number | null }): Promise<Asset> => {
    const { data } = await api.put<Asset>(`/projects/${projectId}/assets/${assetId}`, updates)
    return data
  },

  move: async (projectId: number, assetId: number, newParentId: number | null): Promise<Asset> => {
    const { data } = await api.put<Asset>(`/projects/${projectId}/assets/${assetId}`, {
      parent_id: newParentId
    })
    return data
  },

  delete: async (projectId: number, assetId: number): Promise<void> => {
    await api.delete(`/projects/${projectId}/assets/${assetId}`)
  },
}

// Invitations
export const invitationsApi = {
  // Send invitation
  send: async (projectId: number, email: string, role: string = 'editor'): Promise<Invitation> => {
    const { data } = await api.post<Invitation>(`/projects/${projectId}/invitations`, {
      invitee_email: email,
      role,
    })
    return data
  },

  // List pending invitations for current user
  listPending: async (): Promise<Invitation[]> => {
    const { data } = await api.get<Invitation[]>('/projects/invitations/pending')
    return data
  },

  // List invitations for a project
  listForProject: async (projectId: number): Promise<Invitation[]> => {
    const { data } = await api.get<Invitation[]>(`/projects/${projectId}/invitations`)
    return data
  },

  // Accept invitation
  accept: async (invitationId: number): Promise<void> => {
    await api.post(`/projects/invitations/${invitationId}/accept`)
  },

  // Decline invitation
  decline: async (invitationId: number): Promise<void> => {
    await api.post(`/projects/invitations/${invitationId}/decline`)
  },

  // Cancel invitation (owner/admin only)
  cancel: async (projectId: number, invitationId: number): Promise<void> => {
    await api.delete(`/projects/${projectId}/invitations/${invitationId}`)
  },
}

export default api
