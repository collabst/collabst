<script lang="ts">
  import type { Project } from "$lib/types";
  import ListActionButton from "./ListActionButton.svelte";
  import File from "@lucide/svelte/icons/file";
  import Play from "@lucide/svelte/icons/play";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import UserPlus from "@lucide/svelte/icons/user-plus";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";

  export let projects: Project[];
  export let sortBy: "name" | "created" | "modified";
  export let onSortByColumn: (column: "name" | "created" | "modified") => void;
  export let onInvite: (projectId: number) => void;
  export let onDelete: (projectId: number) => void;

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
</script>

<div class="projects-list">
  {#if projects.length === 0}
    <div class="empty">
      <h2>No projects yet</h2>
      <p>Create your first project to get started!</p>
    </div>
  {:else}
    <div class="list-header">
      <button
        class="list-header-cell project-col"
        onclick={() => onSortByColumn("name")}
      >
        Project
        {#if sortBy === "name"}
          <ChevronDown size={16} />
        {/if}
      </button>
      <div class="list-header-cell actions-col"></div>
      <button
        class="list-header-cell"
        onclick={() => onSortByColumn("created")}
      >
        Created
        {#if sortBy === "created"}
          <ChevronDown size={16} />
        {/if}
      </button>
      <button
        class="list-header-cell"
        onclick={() => onSortByColumn("modified")}
      >
        Last Modified
        {#if sortBy === "modified"}
          <ChevronDown size={16} />
        {/if}
      </button>
    </div>

    {#each projects as project, index (project.id)}
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
              class="role-badge {getRoleBadgeClass(project.current_user_role)}"
            >
              {project.current_user_role}
            </span>
          {/if}
        </div>

        <div class="list-cell actions-col">
          <div class="list-action-buttons">
            <ListActionButton
              action="open"
              icon={Play}
              title="Open"
              href="/editor/{project.id}"
            />

            {#if project.current_user_role === "owner" || project.current_user_role === "admin"}
              <ListActionButton
                action="invite"
                icon={UserPlus}
                title="Invite"
                onclick={(e) => {
                  e.stopPropagation();
                  onInvite(project.id);
                }}
              />
            {/if}

            {#if project.current_user_role === "owner"}
              <ListActionButton
                action="delete"
                icon={Trash2}
                title="Delete"
                onclick={(e) => {
                  e.stopPropagation();
                  onDelete(project.id);
                }}
              />
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

<style>
  .projects-list {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-top: -1rem;
    margin-left: 2.3rem;
    margin-right: 2.3rem;
  }

  .empty {
    text-align: center;
    padding: 4rem;
    color: var(--text-secondary);
  }

  .empty h2 {
    color: var(--text-primary);
    font-weight: 600;
    margin-bottom: 0.5rem;
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
    font-size: 16px;
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
  }

  .list-row:hover {
    background: color-mix(
      in srgb,
      var(--color-tertiary-500) 15%,
      var(--surface-hover) 10%
    );
  }

  .list-row:active:not(:has(.list-action-buttons .action-btn:active)) {
    background: color-mix(
      in srgb,
      var(--color-secondary-500) 50%,
      transparent 95%
    );
    transition: background 0.02s ease-out;
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
</style>
