<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { notifications } from "$lib/stores/notifications";
  import { projectsApi, invitationsApi } from "$lib/services/api";
  import { ThemeToggle, ProfileMenu, Tooltip } from "$lib/components/ui";
  import InvitationsPanel from "$lib/components/InvitationsPanel.svelte";
  import PlaceholderPanel from "$lib/components/editor/PlaceholderPanel.svelte";
  import ProjectsView from "$lib/components/projects/ProjectsView.svelte";
  import CreateProjectModal from "$lib/components/projects/CreateProjectModal.svelte";
  import InviteModal from "$lib/components/projects/InviteModal.svelte";
  import DeleteModal from "$lib/components/projects/DeleteModal.svelte";
  import type { Project } from "$lib/types";
  import collabstLogo from "../../../assets/collabst-text-vertical.svg";
  import CircleHelp from "@lucide/svelte/icons/circle-help";
  import Rocket from "@lucide/svelte/icons/rocket";
  import Settings from "@lucide/svelte/icons/settings";

  let projects = $state<Project[]>([]);
  let loading = $state(true);
  let mounted = $state(false);
  let showCreateModal = $state(false);
  let showInviteModal = $state(false);
  let showDeleteModal = $state(false);
  let showSettingsPanel = $state(false);
  let selectedProjectId = $state<number | null>(null);
  let deleteProjectId = $state<number | null>(null);

  async function loadProjects() {
    try {
      projects = await projectsApi.list();
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      loading = false;
    }
  }

  async function handleCreateProject(name: string, description: string) {
    try {
      const newProject = await projectsApi.create(name, description);
      showCreateModal = false;

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

  async function handleSendInvite(email: string, role: string) {
    if (!selectedProjectId) return;

    try {
      await invitationsApi.send(selectedProjectId, email, role);
      showInviteModal = false;
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

        <ProjectsView
          {projects}
          onCreateProject={() => (showCreateModal = true)}
          onInvite={handleOpenInviteModal}
          onDelete={handleDeleteProject}
        />
      </div>
    </div>

    <CreateProjectModal
      bind:show={showCreateModal}
      onSubmit={handleCreateProject}
    />

    <InviteModal bind:show={showInviteModal} onSubmit={handleSendInvite} />

    <DeleteModal bind:show={showDeleteModal} onConfirm={confirmDeleteProject} />
  </div>
{/if}

<style>
  .container {
    height: 100vh;
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
    align-self: stretch;
  }

  .spacer {
    flex: 1;
    min-height: 0;
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
    position: sticky;
    top: 0;
    z-index: 100;
    flex-shrink: 0;
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
    font-family: "DM Serif Display", Georgia, serif;
    letter-spacing: -0.02em;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 50px;
    color: var(--text-secondary);
    background: var(--bg-top-bar);
  }

  .invitations-section {
    padding: 2rem;
    padding-bottom: 1rem;
    flex-shrink: 0;
  }
</style>
