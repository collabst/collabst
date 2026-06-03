<script lang="ts">
  import EditorPage from "$lib/components/editor/EditorPage.svelte";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { initContext } from "$lib/components/editor/context/index";

  let pageProjectId = $derived(page.params.projectId ?? "");
  let loading = $state(true);

  onMount(async () => {
    await initContext(pageProjectId);
    loading = false;
  });
</script>

{#if loading}
  <div>Loading...</div>
{:else}
  <EditorPage />
{/if}
