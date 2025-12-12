export interface User {
  id: number
  email: string
  username: string
  is_active: boolean
  is_superuser: boolean
  created_at: string
  updated_at: string
}

export interface OwnerInfo {
  id: number
  username: string
  email: string
}

export interface Project {
  id: number
  name: string
  description: string | null
  owner_id: number
  created_at: string
  updated_at: string
  collaborators?: Collaborator[]
  current_user_role?: 'owner' | 'admin' | 'editor' | 'reader'
  owner?: OwnerInfo
  collaborators_count?: number
}

export interface Collaborator {
  id: number
  project_id: number
  user_id: number
  role: 'reader' | 'editor' | 'admin'
  added_at: string
  user?: User
}

export interface File {
  id: number
  project_id: number
  name: string
  path: string
  type: 'typst' | 'text' | 'yaml' | 'json' | 'other'
  content: string
  created_at: string
  updated_at: string
}

export interface Asset {
  id: number
  project_id: number
  filename: string
  storage_path: string
  mime_type: string
  size: number
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export interface Invitation {
  id: number
  project_id: number
  inviter_id: number
  invitee_email: string
  invitee_id: number | null
  role: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  token: string
  expires_at: string
  created_at: string
  updated_at: string
}

export interface CommentRange {
  anchor: number // Absolute position for initial creation
  head: number   // Absolute position for initial creation
}

export interface Comment {
  id: string
  fileId: number
  content: string
  author: {
    id: number
    username: string
    color: string
  }
  createdAt: string
  updatedAt: string
  resolved: boolean
  replies: CommentReply[]
  line: number
}

export interface CommentReply {
  id: string
  content: string
  author: {
    id: number
    username: string
    color: string
  }
  createdAt: string
}
