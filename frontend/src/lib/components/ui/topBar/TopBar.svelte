<script lang="ts">
  import { goto } from "$app/navigation";
  import House from "@lucide/svelte/icons/house";
  import TopButton from "./TopButton.svelte";
  import ProjectName from "./ProjectName.svelte";
  import Breadcrumb from "./Breadcrumb.svelte";
  import ThemeToggle from "./ThemeToggle.svelte";
  import SplitViewButton from "./SplitViewButton.svelte";
  import AwarenessIndicator from "./AwarenessIndicator.svelte";
  import ShareButton from "./ShareButton.svelte";
  import SettingsButton from "./SettingsButton.svelte";
  import ProfileMenu from "./ProfileMenu.svelte";
  import ShareDialog from "$lib/components/projects/sharing/ShareDialog.svelte";
</script>

<div class="top-bar">
  <TopButton
    onclick={() => {
      goto("/projects");
    }}
  >
    <House />
  </TopButton>
  <ProjectName />
  <Breadcrumb />

  <div class="right-section">
    <AwarenessIndicator />
    <SplitViewButton />
    <ShareButton />
    <ThemeToggle />
    <SettingsButton />
    <ProfileMenu />
  </div>
</div>

<ShareDialog />

<style>
  .top-bar {
    display: flex;
    align-items: center;
    min-width: 0;
    background-color: var(--bg-primary);
    padding: 0.4rem 1.5rem;
    gap: 0rem;
  }

  .right-section {
    display: flex;
    align-items: center;
    margin-left: auto;
    padding-left: 0.75rem;
    flex-direction: row;
    gap: 0.25rem;
  }
</style>
