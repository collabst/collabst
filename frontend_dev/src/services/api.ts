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
    content: string
  ): Promise<File> => {
    const { data } = await api.post<File>(`/projects/${projectId}/files`, {
      project_id: projectId,
      name,
      path,
      type,
      content,
    })
    return data
  },

  update: async (projectId: number, fileId: number, content: string): Promise<File> => {
    const { data } = await api.put<File>(`/projects/${projectId}/files/${fileId}`, { content })
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

  upload: async (projectId: number, file: globalThis.File): Promise<Asset> => {
    const formData = new FormData()
    formData.append('file', file as unknown as Blob)

    const { data } = await api.post<Asset>(`/projects/${projectId}/assets/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return data
  },

  getUrl: async (projectId: number, assetId: number): Promise<{ url: string; filename: string; mime_type: string }> => {
    const { data } = await api.get(`/projects/${projectId}/assets/${assetId}/url`)
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
