<script lang="ts">
  import { projectsError, projectsLoading } from "./context";
  import Header from "./Header.svelte";
  import ToolBar from "./ToolBar.svelte";
  import Content from "./Content.svelte";
  import CreateDialog from "./CreateDialog.svelte";
  import DeleteDialog from "./DeleteDialog.svelte";
  import Invitations from "./invitations/Invitations.svelte";
  import ShareDialog from "./sharing/ShareDialog.svelte";
</script>

<div class="page">
  <Header />

  <main class="main">
    <h1 class="title">Dashboard</h1>

    {#if $projectsLoading}
      <p class="notice">Loading projects…</p>
    {:else if $projectsError}
      <p class="notice error">{$projectsError}</p>
    {:else}
      <Invitations />
      <ToolBar />
      <Content />
    {/if}
  </main>
</div>

<CreateDialog />
<DeleteDialog />
<ShareDialog />

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: var(--bg-primary);
  }

  .main {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.5rem 2rem;
  }

  .title {
    margin: 1rem 0 1.5rem 0;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 2.75rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .notice {
    padding: 3rem 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .notice.error {
    color: var(--color-error);
  }
</style>
