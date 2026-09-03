<script lang="ts">
  import type { Project } from "$lib/types";
  import { formatDate, requestDeletion } from "../context";
  import { openShareDialog } from "../sharing/context";
  import RoleBadge from "../RoleBadge.svelte";
  import IconButton from "../IconButton.svelte";
  import FileIcon from "@lucide/svelte/icons/file";
  import Play from "@lucide/svelte/icons/play";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import UserPlus from "@lucide/svelte/icons/user-plus";

  interface Props {
    project: Project;
  }

  let { project }: Props = $props();
</script>

<div class="row">
  <a
    class="row-link"
    href="/editor/{project.id}"
    aria-label="Open {project.name}"
  ></a>

  <div class="cell name-cell">
    <FileIcon size={17} />
    <span class="name">{project.name}</span>
    {#if project.current_user_role}
      <RoleBadge role={project.current_user_role} />
    {/if}
  </div>

  <div class="cell actions-cell">
    <div class="actions">
      <IconButton icon={Play} label="Open" href="/editor/{project.id}" />
      {#if project.current_user_role === "owner" || project.current_user_role === "admin"}
        <IconButton
          icon={UserPlus}
          label="Share"
          tone="positive"
          onclick={(e) => {
            e.stopPropagation();
            openShareDialog(project);
          }}
        />
      {/if}
      {#if project.current_user_role === "owner"}
        <IconButton
          icon={Trash2}
          label="Delete"
          tone="danger"
          onclick={(e) => {
            e.stopPropagation();
            requestDeletion(project);
          }}
        />
      {/if}
    </div>
  </div>

  <div class="cell muted">{formatDate(project.created_at)}</div>
  <div class="cell muted">{formatDate(project.updated_at)}</div>
</div>

<style>
  .row {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 2fr) 7rem minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
    padding: 0.55rem 0.85rem;
    border: 1px solid transparent;
    border-radius: 0.75rem;
  }

  .row:hover {
    border-color: var(--editor-panels-border);
    background-color: var(--surface-hover);
  }

  .row-link {
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: 0.75rem;
  }

  .cell {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    font-size: 0.875rem;
    color: var(--text-primary);
    pointer-events: none;
  }

  .cell :global(svg) {
    color: var(--text-tertiary);
    flex-shrink: 0;
  }

  .name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .muted {
    color: var(--text-secondary);
  }

  .actions {
    display: flex;
    gap: 0.15rem;
    opacity: 0;
    pointer-events: none;
  }

  .row:hover .actions {
    opacity: 1;
    pointer-events: auto;
  }
</style>
