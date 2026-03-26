import axios from 'axios'
import type {
  User,
  Project,
  File,
  Asset,
  AuthResponse,
  Collaborator,
  Invitation,
  UserProfile,
  CollaboratorRole,
  ShareLink,
  ShareLinksSummary,
  SharingOverview,
  CommentThreadDTO,
  CommentThreadCreatePayload,
  CommentThreadUpdatePayload,
  CommentReplyDTO,
  CommentReplyCreatePayload,
} from '../types'
import { getApiUrl } from '../utils/urls'

const API_URL = getApiUrl()

const api = axios.create({
  baseURL: `${API_URL}`,
})
console.log(`API base URL: ${API_URL}`)

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

  get: async (id: string): Promise<Project> => {
    const { data } = await api.get<Project>(`/projects/${id}`)
    return data
  },

  create: async (name: string, description?: string): Promise<Project> => {
    const { data } = await api.post<Project>('/projects', { name, description })
    return data
  },

  update: async (id: string, name?: string, description?: string): Promise<Project> => {
    const { data } = await api.put<Project>(`/projects/${id}`, { name, description })
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`)
  },

  // Collaborators
  listCollaborators: async (projectId: string): Promise<Collaborator[]> => {
    const { data } = await api.get<Collaborator[]>(`/projects/${projectId}/collaborators`)
    return data
  },

  addCollaborator: async (projectId: string, userId: string, role: CollaboratorRole): Promise<Collaborator> => {
    const { data } = await api.post<Collaborator>(`/projects/${projectId}/collaborators`, { user_id: userId, role })
    return data
  },

  updateCollaborator: async (projectId: string, userId: string, role: CollaboratorRole): Promise<Collaborator> => {
    const { data } = await api.put<Collaborator>(`/projects/${projectId}/collaborators/${userId}`, { role })
    return data
  },

  removeCollaborator: async (projectId: string, userId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}/collaborators/${userId}`)
  },
}

export const sharingApi = {
  getOverview: async (projectId: string): Promise<SharingOverview> => {
    const { data } = await api.get<SharingOverview>(`/projects/${projectId}/sharing`)
    return data
  },

  listPublicLinks: async (projectId: string): Promise<ShareLinksSummary> => {
    const { data } = await api.get<ShareLinksSummary>(`/projects/${projectId}/share-links`)
    return data
  },

  createPublicLink: async (projectId: string, linkType: 'read' | 'comment' | 'edit'): Promise<ShareLink> => {
    const { data } = await api.post<ShareLink>(`/projects/${projectId}/share-links/${linkType}`)
    return data
  },

  revokePublicLink: async (projectId: string, linkType: 'read' | 'comment' | 'edit'): Promise<void> => {
    await api.delete(`/projects/${projectId}/share-links/${linkType}`)
  },

  accessByShareHash: async (shareHash: string): Promise<{ project_id: string; permission: 'read' | 'comment' | 'edit'; project_added_to_workspace: boolean }> => {
    const { data } = await api.get(`/projects/share/${shareHash}`)
    return data
  },
}

// Files
export const filesApi = {
  list: async (projectId: string): Promise<File[]> => {
    const { data } = await api.get<File[]>(`/projects/${projectId}/files`)
    return data
  },

  create: async (
    projectId: string,
    name: string,
    content: string,
    parentId: string | null = null,
  ): Promise<File> => {
    const { data } = await api.post<File>(`/projects/${projectId}/files`, {
      name,
      content,
      parent_id: parentId,
      is_folder: false,
    })
    return data
  },

  createFolder: async (
    projectId: string,
    name: string,
    parentId: string | null = null,
  ): Promise<File> => {
    const { data } = await api.post<File>(`/projects/${projectId}/files`, {
      name,
      content: '',
      parent_id: parentId,
      is_folder: true,
    })
    return data
  },

  update: async (
    projectId: string,
    fileId: string,
    updates: { name?: string; content?: string; parent_id?: string | null },
  ): Promise<File> => {
    const { data } = await api.put<File>(`/projects/${projectId}/files/${fileId}`, updates)
    return data
  },

  move: async (
    projectId: string,
    fileId: string,
    newParentId: string | null,
  ): Promise<File> => {
    const { data } = await api.put<File>(`/projects/${projectId}/files/${fileId}`, {
      parent_id: newParentId
    })
    return data
  },

  delete: async (projectId: string, fileId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}/files/${fileId}`)
  },
}

// Assets
export const assetsApi = {
  list: async (projectId: string): Promise<Asset[]> => {
    const { data } = await api.get<Asset[]>(`/projects/${projectId}/assets`)
    return data
  },

  upload: async (
    projectId: string,
    file: globalThis.File,
    parentId: string | null = null,
  ): Promise<File | Asset> => {
    const formData = new FormData();
    formData.append('file', file as unknown as Blob);
    if (parentId !== null) {
      formData.append('parent_id', parentId.toString())
    }

    const { data } = await api.post<File | Asset>(`/projects/${projectId}/assets/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  getUrl: async (projectId: string, assetId: string): Promise<{ url: string; filename: string; mime_type: string }> => {
    const { data } = await api.get(`/projects/${projectId}/assets/${assetId}/url`);
    return data;
  },

  update: async (projectId: string, assetId: string, updates: { filename?: string; parent_id?: string | null }): Promise<Asset> => {
    const { data } = await api.put<Asset>(`/projects/${projectId}/assets/${assetId}`, updates);
    return data;
  },

  move: async (projectId: string, assetId: string, newParentId: string | null): Promise<Asset> => {
    const { data } = await api.put<Asset>(`/projects/${projectId}/assets/${assetId}`, {
      parent_id: newParentId
    });
    return data;
  },

  delete: async (projectId: string, assetId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}/assets/${assetId}`);
  },
};

// Comments
export const commentsApi = {
  listFileThreads: async (projectId: string, fileId: string): Promise<CommentThreadDTO[]> => {
    const { data } = await api.get<CommentThreadDTO[]>(`/projects/${projectId}/comments/files/${fileId}/threads`)
    return data
  },

  createThread: async (projectId: string, payload: CommentThreadCreatePayload): Promise<CommentThreadDTO> => {
    const { data } = await api.post<CommentThreadDTO>(`/projects/${projectId}/comments/threads`, payload)
    return data
  },

  createReply: async (
    projectId: string,
    threadId: string,
    payload: CommentReplyCreatePayload,
  ): Promise<CommentReplyDTO> => {
    const { data } = await api.post<CommentReplyDTO>(`/projects/${projectId}/comments/threads/${threadId}/replies`, payload)
    return data
  },

  updateThread: async (
    projectId: string,
    threadId: string,
    payload: CommentThreadUpdatePayload,
  ): Promise<CommentThreadDTO> => {
    const { data } = await api.patch<CommentThreadDTO>(`/projects/${projectId}/comments/threads/${threadId}`, payload)
    return data
  },
}

// Invitations
export const invitationsApi = {
  // Send invitation
  send: async (projectId: string, email: string, role: CollaboratorRole = 'writer'): Promise<Invitation> => {
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
  listForProject: async (projectId: string): Promise<Invitation[]> => {
    const { data } = await api.get<Invitation[]>(`/projects/${projectId}/invitations`)
    return data
  },

  // Accept invitation
  accept: async (invitationId: string): Promise<void> => {
    await api.post(`/projects/invitations/${invitationId}/accept`)
  },

  // Decline invitation
  decline: async (invitationId: string): Promise<void> => {
    await api.post(`/projects/invitations/${invitationId}/decline`)
  },

  // Cancel invitation (owner/admin only)
  cancel: async (projectId: string, invitationId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}/invitations/${invitationId}`)
  },
}

// Users
export const usersApi = {
  getMe: async (): Promise<User> => {
    const { data } = await api.get<User>('/users/me')
    return data
  },

  getProfile: async (userId: string): Promise<UserProfile> => {
    const { data } = await api.get<UserProfile>(`/users/${userId}`)
    return data
  },

  updateMe: async (updates: { username?: string; email?: string }): Promise<User> => {
    const { data } = await api.patch<User>('/users/me', updates)
    return data
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.patch('/users/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
  },

  uploadProfilePicture: async (file: globalThis.File): Promise<User> => {
    const formData = new FormData()
    formData.append('file', file as unknown as Blob)

    const { data } = await api.post<User>('/users/me/profile-picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  deleteProfilePicture: async (): Promise<User> => {
    const { data } = await api.delete<User>('/users/me/profile-picture')
    return data
  },
}

export default api
