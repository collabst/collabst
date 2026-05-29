<script lang="ts">
  import { goto } from "$app/navigation";
  import { House, Settings, User, Moon } from "@lucide/svelte";
  import TopButton from "./TopButton.svelte";
  import ThemeToggle from "./ThemeToggle.svelte";
</script>

<div class="top-bar">
  <TopButton
    icon={House}
    onclick={() => {
      goto("/projects");
    }}
  />
  <div class="project-name">Project Name</div>

  <div class="right-section">
    <ThemeToggle icon={Moon} onclick={() => {}} />
    <TopButton icon={Settings} onclick={() => {}} />
    <TopButton icon={User} onclick={() => {}} />
  </div>
</div>

<style>
  .top-bar {
    display: flex;
    align-items: center;
    background-color: var(--bg-primary);
    padding: 0.75rem 1.5rem;
    gap: 0.25rem;
  }

  .project-name {
    margin-left: 0.5rem;
    font-size: 1.25rem;
    font-weight: bold;
    color: var(--text-primary);
  }

  .right-section {
    display: flex;
    align-items: center;
    margin-left: auto;
    flex-direction: row;
    gap: 0.25rem;
  }
</style>
