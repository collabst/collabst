<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/stores/auth";
  import { notifications } from "$lib/stores/notifications";
  import { projectsApi, invitationsApi } from "$lib/services/api";
  import { ThemeToggle, ProfileMenu, Tooltip } from "$lib/components/ui";
  import IconToggle from "$lib/components/ui/IconToggle.svelte";
  import DropdownSettingsButton from "$lib/components/ui/DropdownSettingsButton.svelte";
  import InvitationsPanel from "$lib/components/InvitationsPanel.svelte";
  import PlaceholderPanel from "$lib/components/editor/PlaceholderPanel.svelte";
  import type { Project } from "$lib/types";
  import collabstLogo from "../../../assets/collabst-text-vertical.svg";
  import fileIcon from "../../../assets/collabst-file.svg";
  import Play from "@lucide/svelte/icons/play";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import UserPlus from "@lucide/svelte/icons/user-plus";
  import CircleHelp from "@lucide/svelte/icons/circle-help";
  import Rocket from "@lucide/svelte/icons/rocket";
  import Settings from "@lucide/svelte/icons/settings";
  import SendHorizontal from "@lucide/svelte/icons/send-horizontal";
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import List from "@lucide/svelte/icons/list";
  import File from "@lucide/svelte/icons/file";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";

  let projects = $state<Project[]>([]);
  let loading = $state(true);
  let mounted = $state(false);
  let showCreateModal = $state(false);
  let showInviteModal = $state(false);
  let showDeleteModal = $state(false);
  let showSettingsPanel = $state(false);
  let selectedProjectId = $state<number | null>(null);
  let deleteProjectId = $state<number | null>(null);
  let newProjectName = $state("");
  let newProjectDescription = $state("");
  let inviteEmail = $state("");
  let inviteRole = $state("editor");
  let projectNameInput = $state<HTMLInputElement | undefined>();
  let inviteEmailInput = $state<HTMLInputElement | undefined>();

  // Search state
  let searchQuery = $state("");

  // View and sort settings - load from localStorage if available
  let viewMode = $state<"grid" | "list">(
    (typeof localStorage !== "undefined" &&
      (localStorage.getItem("dashboardViewMode") as "grid" | "list")) ||
      "grid",
  );
  let sortBy = $state<"name" | "created" | "modified">(
    (typeof localStorage !== "undefined" &&
      (localStorage.getItem("dashboardSortBy") as
        | "name"
        | "created"
        | "modified")) ||
      "modified",
  );

  // Save view mode to localStorage when it changes
  $effect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("dashboardViewMode", viewMode);
    }
  });

  // Save sort mode to localStorage when it changes
  $effect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("dashboardSortBy", sortBy);
    }
  });

  const viewOptions = [
    { value: "grid", icon: LayoutGrid, label: "Grid View" },
    { value: "list", icon: List, label: "List View" },
  ];

  const sortOptions = [
    { value: "modified", label: "Last Modified" },
    { value: "created", label: "Last Created" },
    { value: "name", label: "Name" },
  ];

  // Focus inputs when modals open
  $effect(() => {
    if (showCreateModal && projectNameInput) {
      setTimeout(() => projectNameInput?.focus(), 0);
    }
  });

  $effect(() => {
    if (showInviteModal && inviteEmailInput) {
      setTimeout(() => inviteEmailInput?.focus(), 0);
    }
  });

  // Handle Escape key for invite modal
  $effect(() => {
    if (!showInviteModal) return;
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        showInviteModal = false;
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  // Handle Escape key for delete modal
  $effect(() => {
    if (!showDeleteModal) return;
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        showDeleteModal = false;
        deleteProjectId = null;
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  // Helper to check if current user is a collaborator (not owner)
  function isCollaborator(project: Project): boolean {
    return project.current_user_role !== "owner";
  }

  // Helper to get role badge color
  function getRoleBadgeClass(role: string): string {
    switch (role) {
      case "admin":
        return "role-admin";
      case "editor":
        return "role-editor";
      case "reader":
        return "role-reader";
      default:
        return "role-owner";
    }
  }

  // Sorting and filtering logic
  const sortedProjects = $derived(() => {
    // First filter by search query
    let filtered = projects;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = projects.filter(
        (project) =>
          project.name.toLowerCase().includes(query) ||
          project.description?.toLowerCase().includes(query),
      );
    }

    // Then sort
    const sorted = [...filtered];
    switch (sortBy) {
      case "name":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "created":
        return sorted.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      case "modified":
      default:
        return sorted.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );
    }
  });

  // Format date for display
  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  function handleSortByColumn(column: "name" | "created" | "modified") {
    sortBy = column;
  }

  async function loadProjects() {
    try {
      projects = await projectsApi.list();
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      loading = false;
    }
  }

  async function handleCreateProject(e: Event) {
    e.preventDefault();
    try {
      const newProject = await projectsApi.create(
        newProjectName,
        newProjectDescription,
      );
      showCreateModal = false;
      newProjectName = "";
      newProjectDescription = "";

      notifications.show("Project created successfully!", "info", 2000);
      // Navigate to the editor - it will handle creating the initial file
      goto(`/editor/${newProject.id}`);
    } catch (error: any) {
      console.error("Failed to create project:", error);
      const message =
        error?.response?.data?.detail || "Failed to create project";
      notifications.show(message, "error", 5000);
    }
  }

  async function handleDeleteProject(id: number) {
    deleteProjectId = id;
    showDeleteModal = true;
  }

  async function confirmDeleteProject() {
    if (deleteProjectId === null) return;

    try {
      await projectsApi.delete(deleteProjectId);
      loadProjects();
      notifications.show("Project deleted successfully", "info", 2000);
    } catch (error: any) {
      console.error("Failed to delete project:", error);
      const message =
        error?.response?.data?.detail || "Failed to delete project";
      notifications.show(message, "error", 5000);
    } finally {
      showDeleteModal = false;
      deleteProjectId = null;
    }
  }

  function handleOpenInviteModal(projectId: number) {
    selectedProjectId = projectId;
    showInviteModal = true;
  }

  async function handleSendInvite(e: Event) {
    e.preventDefault();
    if (!selectedProjectId) return;

    try {
      await invitationsApi.send(selectedProjectId, inviteEmail, inviteRole);
      showInviteModal = false;
      inviteEmail = "";
      inviteRole = "editor";
      notifications.show("Invitation sent successfully!", "info", 3000);
    } catch (error: any) {
      console.error("Failed to send invitation:", error);
      const message =
        error?.response?.data?.detail || "Failed to send invitation";
      notifications.show(message, "error", 5000);
    }
  }

  onMount(() => {
    loadProjects();
    // Set mounted immediately to prevent layout shift
    mounted = true;
  });
</script>

<svelte:head>
  <title>Collabst</title>
</svelte:head>

{#if loading}
  <div class="loading">Loading projects...</div>
{:else}
  <div class="container" class:mounted>
    <header>
      <div class="header-left"></div>
      <div class="header-right">
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>

    <div class="main-container">
      <!-- Activity Bar -->
      <div class="activity-bar">
        <div class="spacer"></div>
        <div class="bottom-activities">
          <Tooltip text="Settings" position="right">
            <button
              class="activity-btn"
              class:active={showSettingsPanel}
              onclick={() => (showSettingsPanel = !showSettingsPanel)}
              aria-label="Settings"
            >
              <Settings size={24} />
            </button>
          </Tooltip>
          <Tooltip text="Typst Universe" position="right">
            <a
              class="activity-btn"
              href="https://typst.app/universe"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Typst Universe"
            >
              <Rocket size={24} />
            </a>
          </Tooltip>
          <Tooltip text="Help" position="right">
            <a
              class="activity-btn"
              href="https://typst.app/docs"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Help"
            >
              <CircleHelp size={24} />
            </a>
          </Tooltip>

          <div class="logo-container">
            <img src={collabstLogo} alt="collabst" class="collabst-logo" />
          </div>
        </div>
      </div>

      <!-- Settings Panel -->
      {#if showSettingsPanel}
        <PlaceholderPanel title="Settings" />
      {/if}

      <!-- Main Content -->
      <div class="content-wrapper">
        <div class="invitations-section">
          <InvitationsPanel />
        </div>

        <div class="content">
          <h1 class="page-title">Dashboard</h1>

          <div class="controls-row">
            <button onclick={() => (showCreateModal = true)} class="create-btn">
              + New Project
            </button>

            <div class="view-controls">
              <label class="search-bar">
                <Search size={16} class="search-icon" />
                <input
                  type="text"
                  bind:value={searchQuery}
                  placeholder="Search projects..."
                  class="search-input"
                />
                {#if searchQuery}
                  <button
                    onclick={() => (searchQuery = "")}
                    class="search-clear"
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                {/if}
              </label>

              <IconToggle bind:value={viewMode} options={viewOptions} />

              <div class="sort-label">Sort by:</div>
              <div class="sort-dropdown">
                <DropdownSettingsButton
                  bind:value={sortBy}
                  options={sortOptions}
                />
              </div>
            </div>
          </div>

          {#if viewMode === "grid"}
            <div class="projects-grid">
              {#if sortedProjects().length === 0}
                <div class="empty">
                  <h2>No projects yet</h2>
                  <p>Create your first project to get started!</p>
                </div>
              {:else}
                {#each sortedProjects() as project (project.id)}
                  <div class="project-card">
                    <a
                      href="/editor/{project.id}"
                      class="card-link"
                      aria-label="Open {project.name}"
                    ></a>

                    <div class="file-icon-container">
                      <img
                        src={fileIcon}
                        alt="Project file"
                        class="file-icon"
                      />

                      <div class="action-buttons">
                        <a
                          href="/editor/{project.id}"
                          class="action-btn open-action"
                          title="Open"
                        >
                          <Play size={16} />
                          <span class="action-label">Open</span>
                        </a>

                        {#if project.current_user_role === "owner" || project.current_user_role === "admin"}
                          <button
                            onclick={(e) => {
                              e.stopPropagation();
                              handleOpenInviteModal(project.id);
                            }}
                            class="action-btn invite-action"
                            title="Invite"
                          >
                            <UserPlus size={16} />
                            <span class="action-label">Invite</span>
                          </button>
                        {/if}

                        {#if project.current_user_role === "owner"}
                          <button
                            onclick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project.id);
                            }}
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
                        <span
                          class="role-badge {getRoleBadgeClass(
                            project.current_user_role,
                          )}"
                        >
                          {project.current_user_role}
                        </span>
                      {/if}
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          {:else}
            <div class="projects-list">
              {#if sortedProjects().length === 0}
                <div class="empty">
                  <h2>No projects yet</h2>
                  <p>Create your first project to get started!</p>
                </div>
              {:else}
                <div class="list-header">
                  <button
                    class="list-header-cell project-col"
                    onclick={() => handleSortByColumn("name")}
                  >
                    Project
                    {#if sortBy === "name"}
                      <ChevronDown size={16} />
                    {/if}
                  </button>
                  <div class="list-header-cell actions-col"></div>
                  <button
                    class="list-header-cell"
                    onclick={() => handleSortByColumn("created")}
                  >
                    Created
                    {#if sortBy === "created"}
                      <ChevronDown size={16} />
                    {/if}
                  </button>
                  <button
                    class="list-header-cell"
                    onclick={() => handleSortByColumn("modified")}
                  >
                    Last Modified
                    {#if sortBy === "modified"}
                      <ChevronDown size={16} />
                    {/if}
                  </button>
                </div>

                {#each sortedProjects() as project, index (project.id)}
                  <div class="list-row" class:odd={index % 2 === 1}>
                    <a
                      href="/editor/{project.id}"
                      class="list-row-link"
                      aria-label="Open {project.name}"
                    ></a>

                    <div class="list-cell project-col">
                      <File size={16} class="project-file-icon" />
                      <span class="project-name">{project.name}</span>
                      {#if project.current_user_role}
                        <span
                          class="role-badge {getRoleBadgeClass(
                            project.current_user_role,
                          )}"
                        >
                          {project.current_user_role}
                        </span>
                      {/if}
                    </div>

                    <div class="list-cell actions-col">
                      <div class="list-action-buttons">
                        <a
                          href="/editor/{project.id}"
                          class="action-btn open-action"
                          title="Open"
                        >
                          <Play size={16} />
                        </a>

                        {#if project.current_user_role === "owner" || project.current_user_role === "admin"}
                          <button
                            onclick={(e) => {
                              e.stopPropagation();
                              handleOpenInviteModal(project.id);
                            }}
                            class="action-btn invite-action"
                            title="Invite"
                          >
                            <UserPlus size={16} />
                          </button>
                        {/if}

                        {#if project.current_user_role === "owner"}
                          <button
                            onclick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project.id);
                            }}
                            class="action-btn delete-action"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        {/if}
                      </div>
                    </div>

                    <div class="list-cell">
                      {formatDate(project.created_at)}
                    </div>

                    <div class="list-cell">
                      {formatDate(project.updated_at)}
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>

    {#if showCreateModal}
      <div
        class="modal"
        onclick={() => (showCreateModal = false)}
        onkeydown={(e) => e.key === "Escape" && (showCreateModal = false)}
        role="presentation"
      >
        <div
          class="modal-content"
          onclick={(e) => e.stopPropagation()}
          onkeydown={(e) => e.stopPropagation()}
          role="dialog"
          tabindex="-1"
        >
          <h2>Create New Project</h2>
          <form onsubmit={handleCreateProject}>
            <div class="field">
              <label for="project-name">Project Name</label>
              <input
                id="project-name"
                bind:this={projectNameInput}
                type="text"
                bind:value={newProjectName}
                required
                placeholder="My Awesome Project"
              />
            </div>
            <div class="field">
              <label for="project-description">Description</label>
              <textarea
                id="project-description"
                bind:value={newProjectDescription}
                placeholder="A brief description of your project"
              ></textarea>
            </div>
            <div class="modal-actions">
              <button
                type="button"
                onclick={() => (showCreateModal = false)}
                class="cancel-btn"
              >
                Cancel
              </button>
              <button type="submit" class="submit-btn"> Create Project </button>
            </div>
          </form>
        </div>
      </div>
    {/if}

    {#if showInviteModal}
      <div
        class="modal"
        onclick={() => (showInviteModal = false)}
        onkeydown={(e) => e.key === "Escape" && (showInviteModal = false)}
        role="presentation"
      >
        <div
          class="modal-content"
          onclick={(e) => e.stopPropagation()}
          onkeydown={(e) => e.stopPropagation()}
          role="dialog"
          tabindex="-1"
        >
          <h2>Invite Collaborator</h2>
          <form onsubmit={handleSendInvite}>
            <div class="field">
              <label for="invite-email">Email Address</label>
              <input
                id="invite-email"
                bind:this={inviteEmailInput}
                type="email"
                bind:value={inviteEmail}
                required
                placeholder="collaborator@example.com"
              />
            </div>
            <div class="field">
              <label for="invite-role">Role</label>
              <select id="invite-role" bind:value={inviteRole}>
                <option value="reader">Reader - Can only view</option>
                <option value="editor">Editor - Can edit files</option>
                <option value="admin">Admin - Can manage collaborators</option>
              </select>
            </div>
            <div class="modal-actions">
              <button
                type="button"
                onclick={() => (showInviteModal = false)}
                class="cancel-btn"
              >
                Cancel
              </button>
              <button type="submit" class="submit-btn">
                Send Invitation
                <SendHorizontal size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}

    {#if showDeleteModal}
      <div
        class="modal"
        onclick={() => {
          showDeleteModal = false;
          deleteProjectId = null;
        }}
        onkeydown={(e) => {
          if (e.key === "Escape") {
            showDeleteModal = false;
            deleteProjectId = null;
          }
        }}
        role="presentation"
      >
        <div
          class="modal-content"
          onclick={(e) => e.stopPropagation()}
          onkeydown={(e) => e.stopPropagation()}
          role="dialog"
          tabindex="-1"
        >
          <h2>Delete Project</h2>
          <p class="delete-message">
            Are you sure you want to delete this project?<br />This action
            cannot be undone and all files will be permanently deleted.
          </p>
          <div class="modal-actions">
            <button
              type="button"
              onclick={() => {
                showDeleteModal = false;
                deleteProjectId = null;
              }}
              class="cancel-btn"
            >
              Cancel
            </button>
            <button
              type="button"
              onclick={confirmDeleteProject}
              class="delete-btn"
            >
              Delete Project
              <Trash2 size={18} />
            </button>
          </div>
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
    visibility: hidden;
  }

  .container.mounted {
    visibility: visible;
    animation: fadeIn 0.1s ease-in;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .main-container {
    display: flex;
    flex: 1;
    overflow: hidden;
    background: var(--bg-top-bar);
    /* Prevent layout shift by reserving space for activity bar */
    min-height: 0;
  }

  .activity-bar {
    width: 56px;
    background: var(--bg-top-bar);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: var(--space-3) 0;
    flex-shrink: 0;
  }

  .spacer {
    flex: 1;
  }

  .bottom-activities {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .activity-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
    text-decoration: none;
  }

  .activity-btn:hover {
    color: var(--text-primary);
    background: var(--surface-hover);
  }

  .activity-btn.active {
    color: var(--text-primary);
    background: var(--surface-hover);
  }

  .activity-btn:active {
    transform: scale(0.9);
  }

  .logo-container {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: var(--space-4);
    padding-bottom: var(--space-4);
  }

  .collabst-logo {
    width: auto;
    height: 110px;
    filter: brightness(0) saturate(100%) invert(60%) sepia(0%) saturate(0%)
      hue-rotate(0deg) brightness(95%) contrast(90%);
    pointer-events: none;
    user-select: none;
  }

  :global([data-theme="light"]) .collabst-logo {
    filter: brightness(0) saturate(100%) invert(40%) sepia(0%) saturate(0%)
      hue-rotate(0deg) brightness(90%) contrast(85%);
  }

  .content-wrapper {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    background: var(--bg-canvas, var(--bg-primary));
    border-top-left-radius: 8px;
    /* Prevent content jump during initial render */
    min-width: 0;
  }

  header {
    background: var(--bg-top-bar);
    padding: 0.25rem 0.5rem 0.25rem 1rem;
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
    gap: 0rem;
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
    flex-shrink: 0;
  }

  .content {
    padding: 2rem;
    padding-top: 1rem;
    flex: 1;
    /* Prevent initial flash */
    contain: layout style;
  }

  .page-title {
    font-size: 48px;
    font-weight: 700;
    margin: 0 0 2rem 0;
    color: var(--text-primary);
    text-align: left;
    font-family: "DM Serif Display", Georgia, serif;
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
  }

  .create-btn:hover {
    background: var(--surface-hover);
    border-color: var(--border-secondary);
  }

  .create-btn:active {
    background: var(--surface-active);
    transform: scale(0.98);
  }

  .controls-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .view-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
  }

  .sort-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .sort-dropdown {
    min-width: 150px;
  }

  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--bg-primary);
    border: 2px solid var(--border-primary);
    border-radius: 4px;
    padding: 0.55rem 0.75rem;
    gap: 0.5rem;
    min-width: 280px;
    cursor: text;
  }

  .search-bar :global(.search-icon) {
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .search-bar:hover {
    border-color: var(--border-secondary);
  }

  .search-bar:focus-within {
    border-color: var(--color-primary-500);
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 14px;
    padding: 0;
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .search-clear {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .search-clear:hover {
    color: var(--text-primary);
  }

  .search-clear:active {
    transform: scale(0.9);
    color: var(--color-error-glow);
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
    position: relative;
  }

  .project-card:hover {
    transform: translateY(-4px);
  }

  .card-link {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .file-icon-container {
    position: relative;
    width: 120px;
    height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.75rem;
    z-index: 2;
    pointer-events: none;
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
    pointer-events: none;
    z-index: 10;
  }

  .project-card:hover .action-buttons {
    opacity: 1;
    pointer-events: auto;
  }

  .action-btn {
    background: #233133;
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
    text-decoration: none;
    pointer-events: auto;
  }

  :global([data-theme="light"]) .action-btn {
    background: #d1e6e8;
  }

  .action-btn .action-label {
    position: absolute;
    top: -2rem;
    left: 50%;
    transform: translateX(-50%);
    background: #233133;
    border: 1px solid var(--border-primary);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 13px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  :global([data-theme="light"]) .action-btn .action-label {
    background: #d1e6e8;
  }

  .action-btn:hover .action-label {
    opacity: 1;
  }

  .action-btn:hover {
    transform: scale(1.1);
  }

  .open-action:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .invite-action:hover {
    border-color: #8ad48e;
    color: #8ad48e;
  }

  /* Light theme: darker green for better contrast */
  :global([data-theme="light"]) .invite-action:hover {
    border-color: #1ea622;
    color: #1ea622;
  }

  .delete-action:hover {
    border-color: #ef7474;
    color: #ef7474;
  }

  /* Light theme: darker red for better contrast */
  :global([data-theme="light"]) .delete-action:hover {
    border-color: #c52525;
    color: #c52525;
  }

  .project-info {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    position: relative;
    z-index: 2;
    pointer-events: none;
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
    background: var(--dialog-backdrop);
    backdrop-filter: blur(var(--dialog-backdrop-blur));
    -webkit-backdrop-filter: blur(var(--dialog-backdrop-blur));
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    z-index: var(--z-modal-backdrop);
    animation: fadeIn var(--transition-fast);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-content {
    background: var(--dialog-bg);
    border: 2px solid var(--dialog-border);
    padding: 2rem;
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 500px;
    box-shadow: var(--shadow-2xl);
    animation: slideUp var(--transition-base);
  }

  .modal-content h2 {
    font-size: 1.7rem;
    font-weight: var(--font-bold);
    margin: 0 0 1.5rem 0;
    color: var(--dialog-text);
  }

  .field {
    margin-bottom: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  label {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--dialog-text);
  }

  input,
  textarea,
  select {
    padding: var(--space-3);
    border: 2px solid var(--dialog-input-border);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    background: var(--bg-primary);
    color: var(--dialog-text);
  }

  input:focus,
  textarea:focus,
  select:focus {
    outline: none;
    border-color: var(--color-theme);
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--text-tertiary);
  }

  textarea {
    min-height: 80px;
    font-family: inherit;
    resize: vertical;
  }

  select option {
    background: var(--dialog-input-bg);
    color: var(--dialog-text);
  }

  .modal-actions {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
    margin-top: 1.5rem;
  }

  .cancel-btn {
    flex: 1;
    background: var(--dialog-cancel-btn-bg);
    color: var(--dialog-text);
    border: none;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-size: var(--text-base);
  }

  .cancel-btn:hover {
    background: var(--dialog-cancel-btn-hover);
  }

  .cancel-btn:active {
    background: var(--dialog-cancel-btn-active);
  }

  .submit-btn {
    flex: 1;
    background: var(--color-theme);
    color: white;
    border: none;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-size: var(--text-base);
  }

  .submit-btn:hover {
    background: var(--color-theme-hover);
    box-shadow: 0 1px 6px var(--color-theme-glow);
  }

  .submit-btn:active {
    box-shadow: 0 1px 12px var(--color-theme-glow);
  }

  .delete-message {
    color: var(--dialog-text);
    font-size: var(--text-lg);
    line-height: 1.5;
    margin: 0;
  }

  .delete-btn {
    flex: 1;
    background: var(--color-error);
    color: white;
    border: 1px solid var(--color-error);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-size: var(--text-base);
  }

  .delete-btn:hover {
    background: var(--color-error-dark);
    box-shadow: 0 1px 8px var(--color-error-glow);
  }

  .delete-btn:active {
    box-shadow: 0 1px 16px var(--color-error-glow);
  }

  /* List View Styles */
  .projects-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .list-header {
    display: grid;
    grid-template-columns: 2fr 150px 1fr 1fr;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--bg-canvas, var(--bg-primary));
    border-bottom: 2px solid var(--border-primary);
    font-weight: 600;
    color: var(--text-primary);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .list-header-cell {
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: color 0.15s;
  }

  .list-header-cell:hover {
    color: var(--color-primary);
  }

  .list-row {
    display: grid;
    grid-template-columns: 2fr 150px 1fr 1fr;
    gap: 1rem;
    padding: 0.75rem 1rem;
    position: relative;
    cursor: pointer;
    background: var(--bg-canvas, var(--bg-primary));
  }

  .list-row.odd {
    background: var(--bg-top-bar);
    border-radius: 4px;
  }

  .list-row:hover {
    background: var(--surface-hover);
    border-radius: 0px;
  }

  .list-row-link {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .list-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 14px;
    color: var(--text-primary);
    position: relative;
    z-index: 2;
    pointer-events: none;
  }

  .project-col {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .project-file-icon {
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .project-name {
    font-weight: 500;
  }

  .actions-col {
    justify-content: flex-start;
  }

  .list-action-buttons {
    display: flex;
    gap: 0.5rem;
    opacity: 0;
    pointer-events: none;
  }

  .list-row:hover .list-action-buttons {
    opacity: 1;
    pointer-events: auto;
  }

  .list-action-buttons .action-btn {
    background: transparent;
    border: none;
    box-shadow: none;
    /* box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2); */
  }

  .list-action-buttons .action-btn:hover {
    transform: scale(1.3);
    transition: all 0.1s;
  }
  .list-action-buttons .action-btn:active {
    transform: scale(1.1);
  }
</style>
