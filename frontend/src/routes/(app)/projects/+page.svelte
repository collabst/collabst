<script lang="ts">
  import ProjectsPage from "$lib/components/projects/ProjectsPage.svelte";
  import { initProjectsContext } from "$lib/components/projects/context";

  $effect(() => {
    void initProjectsContext();
  });
</script>

<svelte:head>
  <title>Collabst</title>
</svelte:head>

<ProjectsPage />
