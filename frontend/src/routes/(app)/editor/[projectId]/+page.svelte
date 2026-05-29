<script lang="ts">
  import EditorPage from "$lib/components/editor/EditorPage.svelte";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { initializeEditorContext } from "$lib/components/editor/context/index";

  let projectId = $derived(page.params.projectId ?? "");
  let loading = $state(true);

  onMount(async () => {
    await initializeEditorContext(projectId);
    loading = false;
  });
</script>

{#if loading}
  <div>Loading...</div>
{:else}
  <EditorPage />
{/if}
