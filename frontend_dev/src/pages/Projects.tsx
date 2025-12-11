import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { projectsApi, invitationsApi } from '../services/api'
import { InvitationsPanel } from '../components/InvitationsPanel'
import type { Project } from '../types'

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const data = await projectsApi.list()
      setProjects(data)
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await projectsApi.create(newProjectName, newProjectDescription)
      setShowCreateModal(false)
      setNewProjectName('')
      setNewProjectDescription('')
      loadProjects()
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  const handleDeleteProject = async (id: number) => {
    if (!confirm('Are you sure you want to delete this project?')) return

    try {
      await projectsApi.delete(id)
      loadProjects()
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  const handleOpenInviteModal = (projectId: number) => {
    setSelectedProjectId(projectId)
    setShowInviteModal(true)
  }

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId) return

    try {
      await invitationsApi.send(selectedProjectId, inviteEmail, inviteRole)
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('editor')
      alert('Invitation sent successfully!')
    } catch (error: any) {
      console.error('Failed to send invitation:', error)
      alert(error.response?.data?.detail || 'Failed to send invitation')
    }
  }

  if (loading) {
    return <div style={styles.loading}>Loading projects...</div>
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>My Projects</h1>
        <div style={styles.headerActions}>
          <button onClick={() => setShowCreateModal(true)} style={styles.createButton}>
            + New Project
          </button>
          <button onClick={logout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </header>

      <div style={{ padding: '2rem', paddingBottom: '1rem' }}>
        <InvitationsPanel />
      </div>

      <div style={styles.projectsGrid}>
        {projects.length === 0 ? (
          <div style={styles.empty}>
            <h2>No projects yet</h2>
            <p>Create your first project to get started!</p>
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} style={styles.projectCard}>
              <h3 style={styles.projectName}>{project.name}</h3>
              <p style={styles.projectDescription}>
                {project.description || 'No description'}
              </p>
              <div style={styles.projectFooter}>
                <button
                  onClick={() => navigate(`/editor/${project.id}`)}
                  style={styles.openButton}
                >
                  Open
                </button>
                <button
                  onClick={() => handleOpenInviteModal(project.id)}
                  style={styles.inviteButton}
                >
                  👥 Invite
                </button>
                <button
                  onClick={() => handleDeleteProject(project.id)}
                  style={styles.deleteButton}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Create New Project</h2>
            <form onSubmit={handleCreateProject}>
              <div style={styles.field}>
                <label style={styles.label}>Project Name</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                  style={styles.input}
                  placeholder="My Awesome Project"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Description</label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  style={{ ...styles.input, minHeight: '80px' }}
                  placeholder="A brief description of your project"
                />
              </div>
              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={styles.cancelButton}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitButton}>
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Invite Collaborator</h2>
            <form onSubmit={handleSendInvite}>
              <div style={styles.field}>
                <label style={styles.label}>Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  style={styles.input}
                  placeholder="collaborator@example.com"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={styles.input}
                >
                  <option value="reader">Reader - Can only view</option>
                  <option value="editor">Editor - Can edit files</option>
                  <option value="admin">Admin - Can manage collaborators</option>
                </select>
              </div>
              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowInviteModal(false)} style={styles.cancelButton}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitButton}>
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f7fafc',
  },
  header: {
    background: 'white',
    padding: '1.5rem 2rem',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    display: 'flex',
    gap: '1rem',
  },
  createButton: {
    background: '#667eea',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  logoutButton: {
    background: '#ef4444',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    color: '#666',
  },
  projectsGrid: {
    padding: '2rem',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1.5rem',
  },
  empty: {
    gridColumn: '1 / -1',
    textAlign: 'center' as const,
    padding: '4rem',
    color: '#666',
  },
  projectCard: {
    background: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  projectName: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
  },
  projectDescription: {
    color: '#666',
    fontSize: '14px',
    flex: 1,
  },
  projectFooter: {
    display: 'flex',
    gap: '0.5rem',
  },
  openButton: {
    flex: 1,
    background: '#667eea',
    color: 'white',
    border: 'none',
    padding: '0.5rem',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  inviteButton: {
    background: '#10b981',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '14px',
  },
  deleteButton: {
    background: '#fee',
    color: '#c33',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  modal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  modalContent: {
    background: 'white',
    padding: '2rem',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '500px',
  },
  modalTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '1.5rem',
    color: '#333',
  },
  field: {
    marginBottom: '1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
  },
  input: {
    padding: '0.75rem',
    border: '2px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '14px',
  },
  modalActions: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1.5rem',
  },
  cancelButton: {
    flex: 1,
    background: '#e5e7eb',
    color: '#333',
    border: 'none',
    padding: '0.75rem',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  submitButton: {
    flex: 1,
    background: '#667eea',
    color: 'white',
    border: 'none',
    padding: '0.75rem',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
  },
}
