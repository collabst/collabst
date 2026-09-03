<script lang="ts">
  import ThemeToggle from "$lib/components/ui/topBar/ThemeToggle.svelte";
  import ProfileMenu from "$lib/components/ui/topBar/ProfileMenu.svelte";
  import collabstLogo from "../../../assets/collabst-text.svg";
</script>

<header class="header">
  <img class="logo" src={collabstLogo} alt="Collabst" />
  <div class="right">
    <ThemeToggle />
    <ProfileMenu />
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1.5rem;
    flex-shrink: 0;
  }

  .logo {
    height: 22px;
    width: auto;
    filter: brightness(0) saturate(100%) invert(60%);
    pointer-events: none;
    user-select: none;
  }

  :global([data-theme="light"]) .logo {
    filter: invert(19%) sepia(20%) saturate(767%) hue-rotate(129deg)
      brightness(95%) contrast(70%);
  }

  .right {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: auto;
  }
</style>
