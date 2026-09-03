<script lang="ts">
  import EditorPage from "$lib/components/editor/EditorPage.svelte";
  import { page } from "$app/state";
  import { initContext, destroyContext, handleIframeMessage, initError } from "$lib/components/editor/context/index";

  let pageProjectId = $derived(page.params.projectId ?? "");
  let loading = $state(true);

  $effect(() => {
    const projectIdValue = pageProjectId;
    let current = true;
    loading = true;

    window.addEventListener("message", handleIframeMessage);
    void (async () => {
      try {
        await initContext(projectIdValue);
      } catch (error) {
        // `initContext` reports its own failures through `initError`; this is
        // only here so an unexpected throw cannot leave the page on "Loading…".
        console.error("Failed to initialise the editor:", error);
      } finally {
        if (current) loading = false;
      }
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
{:else if $initError}
  <div class="init-error">
    <p class="title">This project could not be opened</p>
    <p class="detail">{$initError}</p>
    <a href="/projects">Back to projects</a>
  </div>
{:else}
  <EditorPage />
{/if}

<style>
  .init-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 100%;
    padding: var(--space, 0.5rem);
    text-align: center;
  }

  .title {
    margin: 0;
    color: var(--text-primary);
    font-size: 1rem;
  }

  .detail {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  a {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  a:hover {
    color: var(--text-primary);
  }
</style>
