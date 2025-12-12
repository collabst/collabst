<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth'
  import { projectsApi, invitationsApi } from '$lib/services/api'
  import InvitationsPanel from '$lib/components/InvitationsPanel.svelte'
  import type { Project } from '$lib/types'

  let projects: Project[] = []
  let loading = true
  let showCreateModal = false
  let showInviteModal = false
  let selectedProjectId: number | null = null
  let newProjectName = ''
  let newProjectDescription = ''
  let inviteEmail = ''
  let inviteRole = 'editor'

  // Helper to check if current user is a collaborator (not owner)
  function isCollaborator(project: Project): boolean {
    return project.current_user_role !== 'owner'
  }

  // Helper to get role badge color
  function getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'admin': return 'role-admin'
      case 'editor': return 'role-editor'
      case 'reader': return 'role-reader'
      default: return 'role-owner'
    }
  }

  async function loadProjects() {
    try {
      projects = await projectsApi.list()
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      loading = false
    }
  }

  async function handleCreateProject(e: Event) {
    e.preventDefault()
    try {
      await projectsApi.create(newProjectName, newProjectDescription)
      showCreateModal = false
      newProjectName = ''
      newProjectDescription = ''
      loadProjects()
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  async function handleDeleteProject(id: number) {
    if (!confirm('Are you sure you want to delete this project?')) return

    try {
      await projectsApi.delete(id)
      loadProjects()
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  function handleOpenInviteModal(projectId: number) {
    selectedProjectId = projectId
    showInviteModal = true
  }

  async function handleSendInvite(e: Event) {
    e.preventDefault()
    if (!selectedProjectId) return

    try {
      await invitationsApi.send(selectedProjectId, inviteEmail, inviteRole)
      showInviteModal = false
      inviteEmail = ''
      inviteRole = 'editor'
      alert('Invitation sent successfully!')
    } catch (error: any) {
      console.error('Failed to send invitation:', error)
      alert(error.response?.data?.detail || 'Failed to send invitation')
    }
  }

  onMount(() => {
    loadProjects()
  })
</script>

{#if loading}
  <div class="loading">Loading projects...</div>
{:else}
  <div class="container">
    <header>
      <div class="header-left">
        <h1>My Projects</h1>
        {#if $auth.user}
          <div class="user-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>{$auth.user.username}</span>
          </div>
        {/if}
      </div>
      <div class="header-actions">
        <button on:click={() => showCreateModal = true} class="create-btn">
          + New Project
        </button>
        <button on:click={auth.logout} class="logout-btn">
          Logout
        </button>
      </div>
    </header>

    <div class="invitations-section">
      <InvitationsPanel />
    </div>

    <div class="projects-grid">
      {#if projects.length === 0}
        <div class="empty">
          <h2>No projects yet</h2>
          <p>Create your first project to get started!</p>
        </div>
      {:else}
        {#each projects as project (project.id)}
          <div class="project-card" on:click={() => goto(`/editor/${project.id}`)}>
            <div class="project-header">
              <h3>{project.name}</h3>
              {#if project.current_user_role}
                <span class="role-badge {getRoleBadgeClass(project.current_user_role)}">
                  {project.current_user_role}
                </span>
              {/if}
            </div>

            {#if isCollaborator(project) && project.owner}
              <div class="owner-info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Owned by <strong>{project.owner.username}</strong></span>
              </div>
            {/if}

            <p class="description">
              {project.description || 'No description'}
            </p>

            {#if project.collaborators_count !== undefined && project.collaborators_count > 0}
              <div class="collaborators-count">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span>{project.collaborators_count} collaborator{project.collaborators_count !== 1 ? 's' : ''}</span>
              </div>
            {/if}

            <div class="project-footer" on:click|stopPropagation>
              <button
                on:click={() => goto(`/editor/${project.id}`)}
                class="open-btn"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Open
              </button>
              {#if project.current_user_role === 'owner' || project.current_user_role === 'admin'}
                <button
                  on:click={() => handleOpenInviteModal(project.id)}
                  class="invite-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                  </svg>
                  Invite
                </button>
              {/if}
              {#if project.current_user_role === 'owner'}
                <button
                  on:click={() => handleDeleteProject(project.id)}
                  class="delete-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Delete
                </button>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    {#if showCreateModal}
      <div class="modal" on:click={() => showCreateModal = false}>
        <div class="modal-content" on:click|stopPropagation>
          <h2>Create New Project</h2>
          <form on:submit={handleCreateProject}>
            <div class="field">
              <label>Project Name</label>
              <input
                type="text"
                bind:value={newProjectName}
                required
                placeholder="My Awesome Project"
              />
            </div>
            <div class="field">
              <label>Description</label>
              <textarea
                bind:value={newProjectDescription}
                placeholder="A brief description of your project"
              />
            </div>
            <div class="modal-actions">
              <button type="button" on:click={() => showCreateModal = false} class="cancel-btn">
                Cancel
              </button>
              <button type="submit" class="submit-btn">
                Create Project
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}

    {#if showInviteModal}
      <div class="modal" on:click={() => showInviteModal = false}>
        <div class="modal-content" on:click|stopPropagation>
          <h2>Invite Collaborator</h2>
          <form on:submit={handleSendInvite}>
            <div class="field">
              <label>Email Address</label>
              <input
                type="email"
                bind:value={inviteEmail}
                required
                placeholder="collaborator@example.com"
              />
            </div>
            <div class="field">
              <label>Role</label>
              <select bind:value={inviteRole}>
                <option value="reader">Reader - Can only view</option>
                <option value="editor">Editor - Can edit files</option>
                <option value="admin">Admin - Can manage collaborators</option>
              </select>
            </div>
            <div class="modal-actions">
              <button type="button" on:click={() => showInviteModal = false} class="cancel-btn">
                Cancel
              </button>
              <button type="submit" class="submit-btn">
                Send Invitation
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .container {
    min-height: 100vh;
    background: #1e1e1e;
  }

  header {
    background: #252526;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  h1 {
    font-size: 24px;
    font-weight: 600;
    color: #e8e8e8;
    margin: 0;
  }

  .user-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(14, 99, 156, 0.2);
    border: 1px solid rgba(79, 195, 247, 0.3);
    border-radius: 20px;
    font-size: 14px;
    color: #4fc3f7;
  }

  .user-badge svg {
    opacity: 0.8;
  }

  .header-actions {
    display: flex;
    gap: 1rem;
  }

  .create-btn {
    background: #0e639c;
    color: white;
    border: 1px solid #1177bb;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .create-btn:hover {
    background: #1177bb;
    border-color: #1a8ad4;
  }

  .logout-btn {
    background: transparent;
    color: #e8e8e8;
    border: 1px solid #3e3e42;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .logout-btn:hover {
    background: #3e3e42;
    border-color: #555;
  }

  .loading {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: #999;
    background: #1e1e1e;
  }

  .invitations-section {
    padding: 2rem;
    padding-bottom: 1rem;
  }

  .projects-grid {
    padding: 2rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
  }

  .empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 4rem;
    color: #999;
  }

  .empty h2 {
    color: #e8e8e8;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .project-card {
    background: #252526;
    padding: 1.5rem;
    border-radius: 6px;
    border: 1px solid #3e3e42;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .project-card:hover {
    background: #2d2d30;
    border-color: #555;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .project-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .project-card h3 {
    font-size: 17px;
    font-weight: 600;
    color: #e8e8e8;
    margin: 0;
    flex: 1;
    line-height: 1.4;
  }

  .role-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 0.25rem 0.625rem;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .role-owner {
    background: rgba(14, 99, 156, 0.3);
    color: #4fc3f7;
    border: 1px solid rgba(79, 195, 247, 0.3);
  }

  .role-admin {
    background: rgba(156, 39, 176, 0.3);
    color: #ba68c8;
    border: 1px solid rgba(186, 104, 200, 0.3);
  }

  .role-editor {
    background: rgba(76, 175, 80, 0.3);
    color: #81c784;
    border: 1px solid rgba(129, 199, 132, 0.3);
  }

  .role-reader {
    background: rgba(158, 158, 158, 0.3);
    color: #bdbdbd;
    border: 1px solid rgba(189, 189, 189, 0.3);
  }

  .owner-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 13px;
    color: #b0b0b0;
    padding: 0.375rem 0;
  }

  .owner-info svg {
    opacity: 0.7;
  }

  .owner-info strong {
    color: #4fc3f7;
    font-weight: 600;
  }

  .collaborators-count {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 13px;
    color: #999;
    padding: 0.25rem 0;
  }

  .collaborators-count svg {
    opacity: 0.6;
  }

  .description {
    color: #b0b0b0;
    font-size: 13px;
    flex: 1;
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .project-footer {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid #3e3e42;
  }

  .project-footer button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 13px;
    padding: 0.5rem 0.875rem;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
  }

  .project-footer button svg {
    opacity: 0.8;
  }

  .open-btn {
    flex: 1;
    background: #0e639c;
    color: white;
    border-color: #1177bb;
  }

  .open-btn:hover {
    background: #1177bb;
    border-color: #1a8ad4;
  }

  .invite-btn {
    background: rgba(76, 175, 80, 0.15);
    color: #81c784;
    border-color: rgba(129, 199, 132, 0.3);
  }

  .invite-btn:hover {
    background: rgba(76, 175, 80, 0.25);
    border-color: rgba(129, 199, 132, 0.5);
  }

  .delete-btn {
    background: rgba(244, 67, 54, 0.15);
    color: #e57373;
    border-color: rgba(229, 115, 115, 0.3);
  }

  .delete-btn:hover {
    background: rgba(244, 67, 54, 0.25);
    border-color: rgba(229, 115, 115, 0.5);
  }

  .modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    z-index: 100;
  }

  .modal-content {
    background: #252526;
    padding: 2rem;
    border-radius: 6px;
    border: 1px solid #3e3e42;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .modal-content h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 1.5rem 0;
    color: #e8e8e8;
  }

  .field {
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: 13px;
    font-weight: 500;
    color: #e8e8e8;
  }

  input, textarea, select {
    padding: 0.75rem;
    border: 1px solid #3e3e42;
    border-radius: 4px;
    font-size: 14px;
    background: #1e1e1e;
    color: #e8e8e8;
    transition: all 0.2s;
  }

  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: #0e639c;
    background: #252526;
  }

  input::placeholder, textarea::placeholder {
    color: #6a6a6a;
  }

  textarea {
    min-height: 80px;
    font-family: inherit;
    resize: vertical;
  }

  select option {
    background: #252526;
    color: #e8e8e8;
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .cancel-btn {
    flex: 1;
    background: transparent;
    color: #e8e8e8;
    border: 1px solid #3e3e42;
    padding: 0.75rem;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .cancel-btn:hover {
    background: #3e3e42;
    border-color: #555;
  }

  .submit-btn {
    flex: 1;
    background: #0e639c;
    color: white;
    border: 1px solid #1177bb;
    padding: 0.75rem;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .submit-btn:hover {
    background: #1177bb;
    border-color: #1a8ad4;
  }
</style>
