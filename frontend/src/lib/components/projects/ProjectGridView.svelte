<script lang="ts">
  import type { Project } from "$lib/types";
  import GridActionButton from "./GridActionButton.svelte";
  import RoleBadge from "$lib/components/ui/RoleBadge.svelte";
  import fileIcon from "../../../assets/collabst-file.svg";
  import Play from "@lucide/svelte/icons/play";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import UserPlus from "@lucide/svelte/icons/user-plus";

  export let projects: Project[];
  export let onInvite: (projectId: string) => void;
  export let onDelete: (projectId: string) => void;
</script>

<div class="projects-grid">
  {#if projects.length === 0}
    <div class="empty">
      <h2>No projects yet</h2>
      <p>Create your first project to get started!</p>
    </div>
  {:else}
    {#each projects as project (project.id)}
      <div class="project-card">
        <a
          href="/editor/{project.id}"
          class="card-link"
          aria-label="Open {project.name}"
        ></a>

        <div class="file-icon-container">
          <img src={fileIcon} alt="Project file" class="file-icon" />

          <div class="action-buttons">
            <GridActionButton
              action="open"
              label="Open"
              icon={Play}
              href="/editor/{project.id}"
            />

            {#if project.current_user_role === "owner" || project.current_user_role === "admin"}
              <GridActionButton
                action="invite"
                label="Invite"
                icon={UserPlus}
                onclick={(e) => {
                  e.stopPropagation();
                  onInvite(project.id);
                }}
              />
            {/if}

            {#if project.current_user_role === "owner"}
              <GridActionButton
                action="delete"
                label="Delete"
                icon={Trash2}
                onclick={(e) => {
                  e.stopPropagation();
                  onDelete(project.id);
                }}
              />
            {/if}
          </div>
        </div>

        <div class="project-info">
          <h3>{project.name}</h3>
          {#if project.current_user_role}
            <RoleBadge role={project.current_user_role} />
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 2rem;
    margin-top: 2.25rem;
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

  .project-card:hover .file-icon {
    animation: jiggleAnimation 0.4s ease;
  }

  @keyframes jiggleAnimation {
    0% {
      transform: scaleX(0.96) scaleY(1.04);
    }
    100% {
      transform: none;
    }
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

</style>
