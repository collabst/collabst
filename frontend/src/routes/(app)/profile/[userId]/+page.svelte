<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/stores/auth";
  import { notifications } from "$lib/stores/notifications";
  import { usersApi } from "$lib/services/api";
  import { getProfilePicUrl } from "$lib/utils/urls";
  import type { UserProfile } from "$lib/types";

  let profile = $state<UserProfile | null>(null);
  let loading = $state(true);
  let savingSettings = $state(false);
  let savingPassword = $state(false);
  let savingAvatar = $state(false);

  let settingsUsername = $state("");
  let currentPassword = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let avatarLoaded = $state(false);

  let userId = $derived(Number($page.params.userId));

  $effect(() => {
    userId;
    avatarLoaded = false;
  });

  async function loadProfile() {
    loading = true;
    try {
      profile = await usersApi.getProfile(userId);
      settingsUsername = profile.username;
    } catch (error: any) {
      console.error("Failed to load profile:", error);
      notifications.show(error?.response?.data?.detail || "Failed to load profile", "error");
      goto("/projects");
    } finally {
      loading = false;
    }
  }

  async function handleSaveSettings() {
    if (!profile?.is_self) return;
    savingSettings = true;
    try {
      const updatedUser = await usersApi.updateMe({
        username: settingsUsername.trim() || undefined,
      });
      auth.setUser(updatedUser);
      await loadProfile();
      notifications.show("Profile updated", "info", 2000);
    } catch (error: any) {
      notifications.show(error?.response?.data?.detail || "Failed to update profile", "error");
    } finally {
      savingSettings = false;
    }
  }

  async function handleChangePassword() {
    if (!profile?.is_self) return;
    if (newPassword !== confirmPassword) {
      notifications.show("Passwords do not match", "error", 3000);
      return;
    }

    savingPassword = true;
    try {
      await usersApi.changePassword(currentPassword, newPassword);
      currentPassword = "";
      newPassword = "";
      confirmPassword = "";
      notifications.show("Password updated", "info", 2000);
    } catch (error: any) {
      notifications.show(error?.response?.data?.detail || "Failed to change password", "error");
    } finally {
      savingPassword = false;
    }
  }

  async function handleAvatarUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    savingAvatar = true;
    try {
      const updatedUser = await usersApi.uploadProfilePicture(file);
      auth.setUser(updatedUser);
      await loadProfile();
      notifications.show("Profile picture updated", "info", 2000);
    } catch (error: any) {
      notifications.show(error?.response?.data?.detail || "Failed to upload profile picture", "error");
    } finally {
      target.value = "";
      savingAvatar = false;
    }
  }

  async function handleAvatarDelete() {
    if (!profile?.is_self) return;

    savingAvatar = true;
    try {
      const updatedUser = await usersApi.deleteProfilePicture();
      auth.setUser(updatedUser);
      await loadProfile();
      notifications.show("Profile picture removed", "info", 2000);
    } catch (error: any) {
      notifications.show(error?.response?.data?.detail || "Failed to remove profile picture", "error");
    } finally {
      savingAvatar = false;
    }
  }

  function joinedOn(dateString: string) {
    return new Date(dateString).toLocaleDateString();
  }

  function profilePicSrc(id: number) {
    return getProfilePicUrl(id);
  }

  onMount(loadProfile);
</script>

<svelte:head>
  <title>Profile - Collabst</title>
</svelte:head>

<div class="profile-page">
  {#if loading}
    <div class="loading">Loading profile...</div>
  {:else if profile}
    <div class="card hero">
      <div class="avatar-wrap">
        <div class="avatar avatar-fallback" class:avatar-fallback-hidden={avatarLoaded}>{profile.username[0]?.toUpperCase() || "U"}</div>
        <img
          class="avatar avatar-image"
          class:avatar-image-loaded={avatarLoaded}
          src={profilePicSrc(profile.id)}
          alt={`${profile.username} avatar`}
          onload={() => (avatarLoaded = true)}
          onerror={() => (avatarLoaded = false)}
        />
      </div>
      <div class="hero-body">
        <h1>{profile.username}</h1>
        <p>Member since {joinedOn(profile.created_at)}</p>
        {#if profile.is_self}
          <span class="chip">Your profile</span>
        {/if}
      </div>
    </div>

    {#if profile.is_self}
      <div class="grid">
        <section class="card">
          <h2>Profile picture</h2>
          <div class="row">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onchange={handleAvatarUpload}
              disabled={savingAvatar}
            />
            <button onclick={handleAvatarDelete} disabled={savingAvatar || !avatarLoaded}>
              Remove picture
            </button>
          </div>
        </section>

        <section class="card">
          <h2>Account settings</h2>
          <label>
            Display name
            <input type="text" bind:value={settingsUsername} />
          </label>
          <button onclick={handleSaveSettings} disabled={savingSettings}>
            Save changes
          </button>
        </section>

        <section class="card">
          <h2>Password</h2>
          <label>
            Current password
            <input type="password" bind:value={currentPassword} />
          </label>
          <label>
            New password
            <input type="password" bind:value={newPassword} />
          </label>
          <label>
            Confirm new password
            <input type="password" bind:value={confirmPassword} />
          </label>
          <button onclick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}>
            Change password
          </button>
        </section>
      </div>
    {:else}
      <section class="card">
        <h2>Public profile</h2>
        <p>This user has not shared additional profile details.</p>
      </section>
    {/if}
  {/if}
</div>

<style>
  .profile-page {
    min-height: 100vh;
    padding: 1.5rem;
    background: var(--bg-canvas, var(--bg-primary));
    color: var(--text-primary);
  }

  .loading {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .grid {
    margin-top: 1rem;
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }

  .card {
    border: 1px solid var(--border-primary);
    border-radius: 12px;
    padding: 1rem;
    background: var(--surface-primary);
  }

  .hero {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .hero-body h1 {
    margin: 0;
    font-size: 1.3rem;
  }

  .hero-body p {
    margin: 0.2rem 0 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .avatar-wrap {
    flex-shrink: 0;
    position: relative;
    width: 72px;
    height: 72px;
  }

  .avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--border-primary);
    display: grid;
    place-items: center;
  }

  .avatar-fallback {
    background: var(--surface-secondary);
    font-size: 1.4rem;
    font-weight: 700;
  }

  .avatar-image {
    position: absolute;
    inset: 0;
    opacity: 0;
  }

  .avatar-image-loaded {
    opacity: 1;
  }

  .avatar-fallback-hidden {
    opacity: 0;
  }

  .chip {
    display: inline-block;
    margin-top: 0.4rem;
    border: 1px solid var(--border-primary);
    border-radius: 999px;
    font-size: 0.75rem;
    padding: 0.15rem 0.6rem;
  }

  h2 {
    margin: 0 0 0.9rem;
    font-size: 1rem;
  }

  label {
    display: block;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
  }

  input {
    width: 100%;
    margin-top: 0.3rem;
    background: var(--surface-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    color: var(--text-primary);
    padding: 0.55rem 0.65rem;
  }

  .row {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
  }

  button {
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.55rem 0.75rem;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
