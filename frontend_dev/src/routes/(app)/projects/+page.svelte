<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth'
  import { projectsApi, invitationsApi } from '$lib/services/api'
  import { ThemeToggle, ProfileMenu } from '$lib/components/ui'
  import InvitationsPanel from '$lib/components/InvitationsPanel.svelte'
  import type { Project } from '$lib/types'
  import fileIcon from '../../../assets/collabst-file.svg'
  import Play from '@lucide/svelte/icons/play'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import UserPlus from '@lucide/svelte/icons/user-plus'

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
      </div>
      <div class="header-right">
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>

    <div class="invitations-section">
      <InvitationsPanel />
    </div>

    <div class="content">
      <h1 class="page-title">Dashboard</h1>
      <button on:click={() => showCreateModal = true} class="create-btn">
        + New Project
      </button>

      <div class="projects-grid">
        {#if projects.length === 0}
          <div class="empty">
            <h2>No projects yet</h2>
            <p>Create your first project to get started!</p>
          </div>
        {:else}
          {#each projects as project (project.id)}
            <div class="project-card" on:click={() => goto(`/editor/${project.id}`)}>
              <div class="file-icon-container">
                <img src={fileIcon} alt="Project file" class="file-icon" />
                
                <div class="action-buttons">
                  <button
                    on:click|stopPropagation={() => goto(`/editor/${project.id}`)}
                    class="action-btn open-action"
                    title="Open"
                  >
                    <Play size={16} />
                    <span class="action-label">Open</span>
                  </button>
                  
                  {#if project.current_user_role === 'owner' || project.current_user_role === 'admin'}
                    <button
                      on:click|stopPropagation={() => handleOpenInviteModal(project.id)}
                      class="action-btn invite-action"
                      title="Invite"
                    >
                      <UserPlus size={16} />
                      <span class="action-label">Invite</span>
                    </button>
                  {/if}
                  
                  {#if project.current_user_role === 'owner'}
                    <button
                      on:click|stopPropagation={() => handleDeleteProject(project.id)}
                      class="action-btn delete-action"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                      <span class="action-label">Delete</span>
                    </button>
                  {/if}
                </div>
              </div>

              <div class="project-info">
                <h3>{project.name}</h3>
                {#if project.current_user_role}
                  <span class="role-badge {getRoleBadgeClass(project.current_user_role)}">
                    {project.current_user_role}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>
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
    display: flex;
    flex-direction: column;
    background: var(--bg-canvas, var(--bg-primary));
  }

  header {
    background: var(--bg-top-bar);
    border-bottom: 1px solid var(--border-primary);
    padding: 0.75rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-primary);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
  }

  .loading {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: var(--text-secondary);
    background: var(--bg-primary);
  }

  .invitations-section {
    padding: 2rem;
    padding-bottom: 1rem;
  }

  .content {
    padding: 2rem;
    padding-top: 1rem;
    flex: 1;
  }

  .page-title {
    font-size: 48px;
    font-weight: 700;
    margin: 0 0 2rem 0;
    color: var(--text-primary);
    text-align: left;
    font-family: 'DM Serif Display', Georgia, serif;
    letter-spacing: -0.02em;
  }

  .create-btn {
    background: var(--bg-canvas, var(--bg-primary));
    color: var(--text-primary);
    border: 2px solid var(--border-primary);
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
    margin-bottom: 2rem;
  }

  .create-btn:hover {
    background: var(--surface-hover);
    border-color: var(--border-secondary);
  }

  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 2rem;
  }

  .empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 4rem;
    color: var(--text-secondary);
  }

  .empty h2 {
    color: var(--text-primary);
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .project-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .project-card:hover {
    transform: translateY(-4px);
  }

  .file-icon-container {
    position: relative;
    width: 120px;
    height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.75rem;
  }

  .file-icon {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
  }

  .action-buttons {
    position: absolute;
    top: 65%;
    left: 50%;
    transform: translate(-50%, 0);
    display: flex;
    gap: 0.5rem;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
  }

  .file-icon-container:hover .action-buttons {
    opacity: 1;
    pointer-events: auto;
  }

  .action-btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    color: var(--text-primary);
    padding: 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    position: relative;
  }

  .action-btn .action-label {
    position: absolute;
    top: -2rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .action-btn:hover .action-label {
    opacity: 1;
  }

  .action-btn:hover {
    background: var(--surface-hover);
    transform: scale(1.1);
  }

  .open-action:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .invite-action:hover {
    border-color: #81c784;
    color: #81c784;
  }

  /* Light theme: darker green for better contrast */
  :global([data-theme="light"]) .invite-action:hover {
    border-color: #4caf50;
    color: #4caf50;
  }

  .delete-action:hover {
    border-color: #e57373;
    color: #e57373;
  }

  /* Light theme: darker red for better contrast */
  :global([data-theme="light"]) .delete-action:hover {
    border-color: #d32f2f;
    color: #d32f2f;
  }

  .project-info {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }

  .project-card h3 {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0;
    word-break: break-word;
    max-width: 100%;
  }

  .role-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .role-owner {
    background: rgba(14, 99, 156, 0.3);
    color: #4fc3f7;
    border: 1px solid rgba(79, 195, 247, 0.3);
  }

  /* Light theme: darker blue for better contrast */
  :global([data-theme="light"]) .role-owner {
    background: rgba(14, 99, 156, 0.15);
    color: #0d47a1;
    border: 1px solid rgba(13, 71, 161, 0.3);
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
    background: var(--bg-secondary);
    padding: 2rem;
    border-radius: 6px;
    border: 1px solid var(--border-primary);
    width: 100%;
    max-width: 500px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .modal-content h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 1.5rem 0;
    color: var(--text-primary);
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
    color: var(--text-primary);
  }

  input, textarea, select {
    padding: 0.75rem;
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    font-size: 14px;
    background: var(--bg-input);
    color: var(--text-primary);
    transition: all 0.2s;
  }

  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: var(--color-primary);
    background: var(--bg-secondary);
  }

  input::placeholder, textarea::placeholder {
    color: var(--text-muted);
  }

  textarea {
    min-height: 80px;
    font-family: inherit;
    resize: vertical;
  }

  select option {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .cancel-btn {
    flex: 1;
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border-primary);
    padding: 0.75rem;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .cancel-btn:hover {
    background: var(--surface-hover);
    border-color: var(--border-secondary);
  }

  .submit-btn {
    flex: 1;
    background: var(--color-primary);
    color: white;
    border: 1px solid var(--color-primary-hover);
    padding: 0.75rem;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .submit-btn:hover {
    background: var(--color-primary-hover);
  }
</style>
