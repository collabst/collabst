<script lang="ts">
  import EditorPage from "$lib/components/editor/EditorPage.svelte";
  import { page } from "$app/state";
  import { initContext, destroyContext, handleIframeMessage } from "$lib/components/editor/context/index";

  let pageProjectId = $derived(page.params.projectId ?? "");
  let loading = $state(true);

  $effect(() => {
    const projectIdValue = pageProjectId;
    let current = true;
    loading = true;

    window.addEventListener("message", handleIframeMessage);
    void (async () => {
      await initContext(projectIdValue);
      if (current) loading = false;
    })();

    return () => {
      current = false;
      window.removeEventListener("message", handleIframeMessage);
      destroyContext();
    };
  });
</script>

{#if loading}
  <div>Loading...</div>
{:else}
  <EditorPage />
{/if}
