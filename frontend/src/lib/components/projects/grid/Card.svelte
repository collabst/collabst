<script lang="ts">
  import type { Project } from "$lib/types";
  import RoleBadge from "../RoleBadge.svelte";
  import IconButton from "../IconButton.svelte";
  import { requestDeletion } from "../context";
  import { openShareDialog } from "../sharing/context";
  import fileIcon from "../../../../assets/collabst-file.svg";
  import Play from "@lucide/svelte/icons/play";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import UserPlus from "@lucide/svelte/icons/user-plus";

  interface Props {
    project: Project;
  }

  let { project }: Props = $props();
</script>

<div class="card">
  <!-- The whole card is the link; the action row floats above it on hover. -->
  <a
    class="card-link"
    href="/editor/{project.id}"
    aria-label="Open {project.name}"
  ></a>

  <div class="icon-wrap">
    <img class="file-icon" src={fileIcon} alt="" />
    <div class="actions">
      <IconButton
        icon={Play}
        label="Open"
        href="/editor/{project.id}"
        size={16}
      />
      {#if project.current_user_role === "owner" || project.current_user_role === "admin"}
        <IconButton
          icon={UserPlus}
          label="Share"
          tone="positive"
          size={16}
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
          size={16}
          onclick={(e) => {
            e.stopPropagation();
            requestDeletion(project);
          }}
        />
      {/if}
    </div>
  </div>

  <div class="info">
    <span class="name">{project.name}</span>
    {#if project.current_user_role}
      <RoleBadge role={project.current_user_role} />
    {/if}
  </div>
</div>

<style>
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 0.5rem 1rem 0.5rem;
    border: 1px solid transparent;
    border-radius: 1rem;
    cursor: pointer;
  }

  .card:hover {
    border-color: var(--editor-panels-border);
    background-color: var(--surface-hover);
    transform: translateY(-3px);
  }

  .card:hover .file-icon {
    animation: jiggleAnimation 0.4s ease;
  }

  @keyframes jiggleAnimation {
    0% {
      transform: scaleX(0.94) scaleY(1.06);
    }
    100% {
      transform: none;
    }
  }

  .card-link {
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: 1rem;
  }

  .icon-wrap {
    position: relative;
    width: 110px;
    height: 130px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.6rem;
    z-index: 2;
    pointer-events: none;
  }

  .file-icon {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 2px 8px rgb(0 0 0 / 0.2));
  }

  .actions {
    position: absolute;
    top: 62%;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 0.25rem;
    padding: 0.2rem;
    border: 1px solid var(--navbar-border);
    border-radius: 0.7rem;
    background-color: color-mix(in srgb, var(--navbar-bg), transparent 10%);
    backdrop-filter: blur(12px);
    box-shadow: 0 3px 0 0 var(--navbar-shadow);
    opacity: 0;
    pointer-events: none;
  }

  .card:hover .actions {
    opacity: 1;
    pointer-events: auto;
  }

  .info {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    pointer-events: none;
  }

  .name {
    max-width: 100%;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    text-align: center;
    overflow-wrap: anywhere;
  }
</style>
