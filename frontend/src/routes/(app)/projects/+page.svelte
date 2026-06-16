<script lang="ts">
  import { onMount } from "svelte";
  import { projectsApi, filesApi } from "$lib/services/api";
  import type { Project } from "$lib/types";

  let projects: Project[] = $state([]);

  onMount(async () => {
    projects = await projectsApi.list();
  });

  async function submit(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const input = form.querySelector("input") as HTMLInputElement;
    const name = input.value.trim();
    if (name) {
      const project = await projectsApi.create(name);
      projects = [...projects, project];
      input.value = "";
      const file = await filesApi.create(project.id, "main.typ", "Hello world!\n#pagebreak()\nReHelloworld!");
    }
  }
</script>

<form onsubmit={submit}>
  <input type="text" placeholder="New project name" />
  <button type="submit">Create</button>
</form>
<div class="project-list">
  {#each projects as project}
    <a href="/editor/{project.id}">{project.name}</a>
  {/each}
</div>

<style>
  .project-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
