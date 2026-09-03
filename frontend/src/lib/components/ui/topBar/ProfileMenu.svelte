<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { getProfilePicUrl } from "$lib/utils/urls";
  import UserSettings from "$lib/components/ui/settings/UserSettings.svelte";
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import LogOut from "@lucide/svelte/icons/log-out";

  let open = $state(false);
  let settingsOpen = $state(false);
  let avatarLoaded = $state(false);

  // A new user means a new avatar URL; assume it fails until it loads.
  $effect(() => {
    void $auth.user?.id;
    avatarLoaded = false;
  });

  let initial = $derived(($auth.user?.display_name || "U")[0].toUpperCase());

  function handleLogout() {
    open = false;
    void auth.logout();
  }

  function handleSettings() {
    if (!$auth.user) return;
    open = false;
    settingsOpen = true;
  }
</script>

<div class="profile">
  <button
    class="avatar"
    onclick={() => (open = !open)}
    aria-label="Open profile menu"
  >
    <span class="initial" class:hidden={avatarLoaded}>{initial}</span>
    {#if $auth.user?.id}
      <img
        class="picture"
        class:loaded={avatarLoaded}
        src={getProfilePicUrl($auth.user.id)}
        alt=""
        onload={() => (avatarLoaded = true)}
        onerror={() => (avatarLoaded = false)}
      />
    {/if}
  </button>

  {#if open}
    <button
      class="backdrop"
      aria-label="Close profile menu"
      onclick={() => (open = false)}
    ></button>
    <div class="menu">
      <div class="who">{$auth.user?.display_name || "User"}</div>
      <div class="divider"></div>
      <button class="item" onclick={handleSettings}>
        <CircleUser size={15} /> Account settings
      </button>
      <button class="item danger" onclick={handleLogout}>
        <LogOut size={15} /> Log out
      </button>
    </div>
  {/if}
</div>

<UserSettings bind:open={settingsOpen} />

<style>
  .profile {
    position: relative;
    display: flex;
  }

  .avatar {
    position: relative;
    width: 28px;
    height: 28px;
    margin-left: 0.25rem;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--navbar-border);
    border-radius: 999px;
    background-color: var(--navbar-bg);
    cursor: pointer;
  }

  .avatar:hover {
    background-color: var(--surface-hover);
  }

  .avatar:active {
    transform: scaleX(1.1) scaleY(0.95);
  }

  .initial {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .initial.hidden {
    opacity: 0;
  }

  .picture {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 999px;
    opacity: 0;
  }

  .picture.loaded {
    opacity: 1;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    border: none;
    background: transparent;
    cursor: default;
  }

  .menu {
    position: absolute;
    z-index: 41;
    top: calc(100% + 0.5rem);
    right: 0;
    min-width: 11rem;
    display: flex;
    flex-direction: column;
    padding: 0.35rem;
    border: 1px solid var(--navbar-border);
    border-radius: 0.75rem;
    background-color: color-mix(in srgb, var(--navbar-bg), transparent 10%);
    backdrop-filter: blur(12px);
    box-shadow:
      0 3px 0 0 var(--navbar-shadow),
      0 12px 28px -12px rgb(0 0 0 / 0.35);
  }

  .who {
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .divider {
    height: 1px;
    margin: 0.25rem 0.35rem;
    background-color: var(--navbar-border);
  }

  .item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--text-secondary);
    font: inherit;
    font-size: 0.85rem;
    text-align: left;
    cursor: pointer;
  }

  .item:hover {
    background-color: var(--surface-hover);
    color: var(--text-primary);
  }

  .item:active {
    transform: translateY(1px);
  }

  .item.danger:hover,
  .item.danger:hover :global(svg) {
    color: var(--color-error);
  }
</style>
