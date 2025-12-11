import React, { useState, useEffect } from 'react'
import { invitationsApi } from '../services/api'
import type { Invitation } from '../types'

export const InvitationsPanel: React.FC = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInvitations()
  }, [])

  const loadInvitations = async () => {
    try {
      const data = await invitationsApi.listPending()
      setInvitations(data)
    } catch (error) {
      console.error('Failed to load invitations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (id: number) => {
    try {
      await invitationsApi.accept(id)
      loadInvitations()
      // Reload projects to show new shared project
      window.location.reload()
    } catch (error) {
      console.error('Failed to accept invitation:', error)
      alert('Failed to accept invitation')
    }
  }

  const handleDecline = async (id: number) => {
    try {
      await invitationsApi.decline(id)
      loadInvitations()
    } catch (error) {
      console.error('Failed to decline invitation:', error)
    }
  }

  if (loading) {
    return <div style={styles.loading}>Loading invitations...</div>
  }

  if (invitations.length === 0) {
    return null
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>📬 Pending Invitations ({invitations.length})</h3>
      </div>
      <div style={styles.list}>
        {invitations.map((invitation) => (
          <div key={invitation.id} style={styles.invitation}>
            <div style={styles.info}>
              <div style={styles.role}>{invitation.role.toUpperCase()}</div>
              <div style={styles.email}>From: {invitation.invitee_email}</div>
              <div style={styles.date}>
                {new Date(invitation.created_at).toLocaleDateString()}
              </div>
            </div>
            <div style={styles.actions}>
              <button
                onClick={() => handleAccept(invitation.id)}
                style={styles.acceptButton}
              >
                ✓ Accept
              </button>
              <button
                onClick={() => handleDecline(invitation.id)}
                style={styles.declineButton}
              >
                ✗ Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: {
    background: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    marginBottom: '1rem',
    overflow: 'hidden',
  },
  header: {
    padding: '1rem',
    borderBottom: '1px solid #ffc107',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#856404',
  },
  list: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  invitation: {
    background: 'white',
    padding: '1rem',
    borderRadius: '6px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  info: {
    flex: 1,
  },
  role: {
    display: 'inline-block',
    background: '#667eea',
    color: 'white',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '0.5rem',
  },
  email: {
    fontSize: '14px',
    color: '#333',
    marginBottom: '0.25rem',
  },
  date: {
    fontSize: '12px',
    color: '#666',
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
  },
  acceptButton: {
    background: '#10b981',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '14px',
  },
  declineButton: {
    background: '#ef4444',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '14px',
  },
  loading: {
    padding: '1rem',
    textAlign: 'center' as const,
    color: '#666',
  },
}
