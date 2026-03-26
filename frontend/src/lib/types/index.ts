export interface BaseUser {
  id: string
  display_name: string
  user_type: 'auth' | 'guest'
  created_at: string
  updated_at: string
}

export interface AuthUser extends BaseUser {
  user_type: 'auth'
  email: string
  is_active: boolean
  is_superuser: boolean
}

export interface GuestUser extends BaseUser {
  user_type: 'guest'
  email?: string
  is_active?: boolean
  is_superuser?: boolean
}

export type User = AuthUser | GuestUser

export interface OwnerInfo {
  id: string
  display_name: string
  email?: string
  user_type?: 'auth' | 'guest'
}

export type ProjectRole = 'owner' | 'admin' | 'writer' | 'commentor' | 'reader'
export type CollaboratorRole = 'owner' | 'reader' | 'commentor' | 'writer' | 'admin'

export interface Project {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
  updated_at: string
  collaborators?: Collaborator[]
  current_user_role?: ProjectRole
  owner?: OwnerInfo
  collaborators_count?: number
}

export interface Collaborator {
  id: string
  project_id: string
  user_id: string
  role: CollaboratorRole
  created_at: string
  updated_at: string
  user?: User
}

export interface File {
  id: string;
  project_id: string;
  name: string;
  path: string;
  content: string;
  parent_id: string | null;
  is_folder: boolean;
  created_at: string;
  updated_at: string;
}

export interface FileTreeNode extends File {
  children: FileTreeNode[]
  level: number
  isExpanded: boolean
}

export interface Asset {
  id: string
  project_id: string
  filename: string
  path: string
  storage_path: string
  mime_type: string
  size: number
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export interface ShareAccessResponse {
  project_id: string
  permission: 'read' | 'comment' | 'edit'
  project_added_to_workspace: boolean
  access_token?: string
  refresh_token?: string
  token_type?: string
  user?: User
}

export interface UserProfile {
  id: string
  display_name: string
  created_at: string
  updated_at: string
  is_self: boolean
  email?: string | null
  is_active?: boolean | null
  is_superuser?: boolean | null
}

export interface Invitation {
  id: string
  project_id: string
  inviter_id: string
  invitee_email: string
  invitee_id: string | null
  role: CollaboratorRole
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  token: string
  expires_at: string
  created_at: string
  updated_at: string
}

export interface ShareLink {
  link_type: 'read' | 'comment' | 'edit'
  hash: string
  url: string
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export interface ShareLinksSummary {
  read: ShareLink | null
  comment: ShareLink | null
  edit: ShareLink | null
}

export interface SharingOverview {
  public_links: ShareLinksSummary
  collaborators: Collaborator[]
  invitations: Invitation[]
}

export interface CommentRange {
  anchor: number // Absolute position for initial creation
  head: number   // Absolute position for initial creation
}

export interface Comment {
  id: string
  fileId: string
  content: string
  authorId: string
  createdAt: string
  updatedAt: string
  resolved: boolean
  replies: CommentReply[]
  line: number
  anchorRelJson?: string | null
  headRelJson?: string | null
}

export interface CommentReply {
  id: string
  content: string
  authorId: string
  createdAt: string
}

export type CommentThreadStatus = 'open' | 'resolved' | 'deleted'
export type CommentReplyStatus = 'active' | 'deleted'

export interface CommentReplyDTO {
  id: string
  thread_id: string
  author_id: string
  content: string
  status: CommentReplyStatus
  created_at: string
  updated_at: string
}

export interface CommentThreadDTO {
  id: string
  project_id: string
  file_id: string
  author_id: string
  content: string
  status: CommentThreadStatus
  anchor_rel_json: string | null
  head_rel_json: string | null
  resolved_at: string | null
  resolved_by_id: string | null
  created_at: string
  updated_at: string
  replies: CommentReplyDTO[]
}

export interface CommentThreadCreatePayload {
  file_id: string
  content: string
  anchor_rel_json?: string | null
  head_rel_json?: string | null
}

export interface CommentThreadUpdatePayload {
  content?: string
  status?: CommentThreadStatus
}

export interface CommentReplyCreatePayload {
  content: string
}

export interface CommentNotificationMessage {
  type: 'comment_thread_created' | 'comment_reply_created' | 'comment_thread_updated' | 'permission_changed'
  thread?: CommentThreadDTO
  reply?: CommentReplyDTO
  thread_id?: string
  action?: 'role_updated' | 'removed_from_project'
  new_role?: CollaboratorRole
  reason?: string
  changed_at?: string
}

export interface DiagnosticRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface Diagnostic {
  severity: string;
  message: string;
  range?: DiagnosticRange;
  path?: string;
  package?: string;
}
