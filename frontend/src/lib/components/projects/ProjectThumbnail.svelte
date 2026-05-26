<script lang="ts">
  import type { Project } from "$lib/types";
  import { projectsApi } from "$lib/services/api";
  import fileIcon from "../../../assets/collabst-file.svg";

  let { project } = $props<{
    project: Project;
  }>();

  let thumbnailUrl = $state<string | null>(null);
  let loadFailed = $state(false);
  let loadRequestId = 0;

  $effect(() => {
    const projectId = project.id;
    const thumbnailUpdatedAt = project.thumbnail_updated_at;
    const requestId = ++loadRequestId;

    thumbnailUrl = null;
    loadFailed = false;

    if (!thumbnailUpdatedAt) return;

    projectsApi
      .getThumbnail(projectId)
      .then((thumbnail) => {
        if (requestId === loadRequestId) {
          thumbnailUrl = thumbnail.url;
        }
      })
      .catch(() => {
        if (requestId === loadRequestId) {
          loadFailed = true;
        }
      });
  });
</script>

<div class="project-thumbnail" class:has-thumbnail={thumbnailUrl && !loadFailed}>
  {#if thumbnailUrl && !loadFailed}
    <img
      src={thumbnailUrl}
      alt="{project.name} preview"
      class="thumbnail-image"
      onerror={() => (loadFailed = true)}
    />
  {:else}
    <img src={fileIcon} alt="Project file" class="fallback-icon" />
  {/if}
</div>

<style>
  .project-thumbnail {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
  }

  .thumbnail-image {
    width: auto;
    max-width: 104px;
    max-height: 136px;
    object-fit: contain;
    border-radius: 3px;
    background: #ffffff;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.12),
      0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .fallback-icon {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
  }
</style>
