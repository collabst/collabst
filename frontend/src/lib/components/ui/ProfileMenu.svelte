<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { Tooltip } from "$lib/components/ui";
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import LogOut from "@lucide/svelte/icons/log-out";
  import { getProfilePicUrl } from "$lib/utils/urls";
  import UserSettingsModal from "./UserSettingsModal.svelte";

  let showMenu = $state(false);
  let showSettingsModal = $state(false);
  let avatarLoaded = $state(false);

  $effect(() => {
    $auth.user?.id;
    avatarLoaded = false;
  });

  function toggleMenu() {
    showMenu = !showMenu;
  }

  function handleLogout() {
    showMenu = false;
    auth.logout();
  }

  function handleOpenSettings() {
    if (!$auth.user) return;
    showMenu = false;
    showSettingsModal = true;
  }

  function profilePicSrc() {
    if (!$auth.user?.id) return "";
    return getProfilePicUrl($auth.user.id);
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".profile-menu-container")) {
      showMenu = false;
    }
  }

  $effect(() => {
    if (showMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }
  });
</script>

<div class="profile-menu-container">
  <Tooltip text="Profile menu" position="bottom">
    <button class="avatar-trigger" onclick={toggleMenu} aria-label="Open profile menu">
      <span class="avatar-fallback" class:avatar-fallback-hidden={avatarLoaded}>
        {($auth.user?.username || "U")[0].toUpperCase()}
      </span>
      {#if $auth.user?.id}
        <img
          class="avatar-image avatar-image-trigger"
          class:avatar-image-loaded={avatarLoaded}
          src={profilePicSrc()}
          alt="User avatar"
          onload={() => (avatarLoaded = true)}
          onerror={() => (avatarLoaded = false)}
        />
      {/if}
    </button>
  </Tooltip>

  {#if showMenu}
    <div class="profile-dropdown">
      <div class="profile-info">
        <span>{$auth.user?.username || "User"}</span>
      </div>
      <div class="divider"></div>
      <button class="menu-item" onclick={handleOpenSettings}>
        <CircleUser size={16} />
        <span>Settings</span>
      </button>
      <button class="menu-item" onclick={handleLogout}>
        <LogOut size={16} />
        <span>Logout</span>
      </button>
    </div>
  {/if}

  <UserSettingsModal bind:open={showSettingsModal} />
</div>

<style>
  .profile-menu-container {
    position: relative;
  }

  .avatar-trigger {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid var(--border-primary);
    background: var(--bg-file-panel);
    padding: 0;
    overflow: hidden;
    position: relative;
    cursor: pointer;
    margin-left: 0.15rem;
  }

  .avatar-trigger:hover {
    background: var(--surface-active);
  }

  .avatar-trigger:active {
    transform: scaleX(1.1) scaleY(0.95);
  }

  .avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 999px;
  }

  .avatar-image-trigger {
    position: absolute;
    inset: 0;
    opacity: 0;
  }

  .avatar-image-loaded {
    opacity: 1;
  }

  .avatar-fallback {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 400;
  }

  .avatar-fallback-hidden {
    opacity: 0;
  }

  .profile-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background: var(--dropdown-bg);
    backdrop-filter: blur(var(--dropdown-blur));
    -webkit-backdrop-filter: blur(var(--dropdown-blur));
    border: 1px solid var(--dropdown-border);
    border-radius: 6px;
    min-width: 150px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    overflow: hidden;
    animation: slideDown 0.2s cubic-bezier(0.4, 0.2, 0.2, 1);
  }

  @keyframes slideDown {
    0% {
    opacity: 0;
    transform: translateY(-40px);
    }
    75% {
    transform: translateY(4px);
    }
    100% {
    opacity: 1;
    transform: translateY(0);
    }
  }

  .profile-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    color: var(--text-secondary);
    font-size: 18px;
    font-weight: 700;
  }

  .divider {
    height: 1px;
    background: var(--border-primary);
    margin: 0;
  }

  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 14px;
    cursor: pointer;
    text-align: left;
  }

  .menu-item:hover {
    background: var(--dropdown-hover-bg);
  }
</style>
