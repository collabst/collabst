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
    <ThemeToggle />
    <TopButton icon={Settings} onclick={() => {}} />
    <TopButton icon={User} onclick={() => {}} />
  </div>
</div>

<style>
  .top-bar {
    display: flex;
    align-items: center;
    background-color: var(--bg-primary);
    padding: 0.4rem 1.5rem;
    gap: 0rem;
  }

  .project-name {
    margin-left: 0.5rem;
    font-size: 1.15rem;
    letter-spacing: -0.03em;
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
