<script lang="ts">
    import Pencil from "@lucide/svelte/icons/pencil";
    import Trash2 from "@lucide/svelte/icons/trash-2";
    import { auth } from "$lib/stores/auth";
    import { notifications } from "$lib/stores/notifications";
    import { usersApi } from "$lib/services/api";
    import { getProfilePicUrl } from "$lib/utils/urls";
    import Button from "./Button.svelte";
    import Input from "./Input.svelte";
    import Modal from "./Modal.svelte";
    import DeleteConfirmModal from "$lib/components/editor/DeleteConfirmModal.svelte";

    interface UserSettingsModalProps {
        open?: boolean;
        onClose?: () => void;
    }

    let { open = $bindable(false), onClose }: UserSettingsModalProps = $props();

    let savingSettings = $state(false);
    let savingPassword = $state(false);
    let savingAvatar = $state(false);
    let avatarLoaded = $state(false);
    let showDeleteAvatarModal = $state(false);

    let settingsUsername = $state("");
    let currentPassword = $state("");
    let newPassword = $state("");
    let confirmPassword = $state("");

    let fileInput: HTMLInputElement | undefined = $state();

    function resetForm() {
        settingsUsername = $auth.user?.username || "";
        currentPassword = "";
        newPassword = "";
        confirmPassword = "";
        avatarLoaded = false;
    }

    $effect(() => {
        if (!open) return;
        $auth.user?.id;
        resetForm();
    });

    function profilePicSrc() {
        if (!$auth.user?.id) return "";
        return getProfilePicUrl($auth.user.id);
    }

    function joinedOn(dateString: string) {
        return new Date(dateString).toLocaleDateString();
    }

    function handleClose() {
        open = false;
        onClose?.();
    }

    function openFileBrowser() {
        if (savingAvatar) return;
        fileInput?.click();
    }

    async function handleAvatarUpload(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;

        savingAvatar = true;
        try {
            const updatedUser = await usersApi.uploadProfilePicture(file);
            auth.setUser(updatedUser);
            avatarLoaded = false;
            notifications.show("Profile picture updated", "info", 2000);
        } catch (error: any) {
            notifications.show(
                error?.response?.data?.detail ||
                    "Failed to upload profile picture",
                "error",
            );
        } finally {
            target.value = "";
            savingAvatar = false;
        }
    }

    function askDeleteAvatar(event: MouseEvent) {
        event.stopPropagation();
        if (savingAvatar || !avatarLoaded) return;
        showDeleteAvatarModal = true;
    }

    async function handleAvatarDelete() {
        savingAvatar = true;
        try {
            const updatedUser = await usersApi.deleteProfilePicture();
            auth.setUser(updatedUser);
            avatarLoaded = false;
            showDeleteAvatarModal = false;
            notifications.show("Profile picture removed", "info", 2000);
        } catch (error: any) {
            notifications.show(
                error?.response?.data?.detail ||
                    "Failed to remove profile picture",
                "error",
            );
        } finally {
            savingAvatar = false;
        }
    }

    async function handleSaveSettings() {
        if (!$auth.user) return;

        savingSettings = true;
        try {
            const updatedUser = await usersApi.updateMe({
                username: settingsUsername.trim() || undefined,
            });
            auth.setUser(updatedUser);
            notifications.show("Profile updated", "info", 2000);
            handleClose();
        } catch (error: any) {
            notifications.show(
                error?.response?.data?.detail || "Failed to update profile",
                "error",
            );
        } finally {
            savingSettings = false;
        }
    }

    async function handleChangePassword() {
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
            notifications.show(
                error?.response?.data?.detail || "Failed to change password",
                "error",
            );
        } finally {
            savingPassword = false;
        }
    }
</script>

<Modal bind:open title="User settings" size="md" onClose={handleClose}>
    {#if $auth.user}
        <section class="hero">
            <div class="avatar-editor">
                <span
                    class="avatar-fallback"
                    class:avatar-fallback-hidden={avatarLoaded}
                >
                    {($auth.user.username || "U")[0].toUpperCase()}
                </span>
                <img
                    class="avatar-image"
                    class:avatar-image-loaded={avatarLoaded}
                    src={profilePicSrc()}
                    alt="Your avatar"
                    onload={() => (avatarLoaded = true)}
                    onerror={() => (avatarLoaded = false)}
                />

                <div class="avatar-overlay">
                    <button
                        type="button"
                        class="avatar-action"
                        onclick={openFileBrowser}
                        disabled={savingAvatar}
                        title="Change profile picture"
                        aria-label="Change profile picture"
                    >
                        <Pencil size={15} />
                    </button>
                    {#if avatarLoaded}
                        <button
                            type="button"
                            class="avatar-action avatar-action-danger"
                            onclick={askDeleteAvatar}
                            disabled={savingAvatar}
                            title="Remove profile picture"
                            aria-label="Remove profile picture"
                        >
                            <Trash2 size={15} />
                        </button>
                    {/if}
                </div>

                <input
                    bind:this={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    class="hidden-file-input"
                    onchange={handleAvatarUpload}
                    disabled={savingAvatar}
                />
            </div>

            <div class="hero-meta">
                <h2>{$auth.user.username}</h2>
                <p>Member since {joinedOn($auth.user.created_at)}</p>
            </div>
        </section>

        <section class="section">
            <h3>Account settings</h3>
            <div class="fields">
                <Input
                    label="Display name"
                    bind:value={settingsUsername}
                    fullWidth
                />
                <Input
                    label="Login email"
                    value={$auth.user.email}
                    disabled
                    fullWidth
                />
            </div>
        </section>

        <section class="section">
            <h3>Password</h3>
            <div class="fields">
                <Input
                    type="password"
                    label="Current password"
                    bind:value={currentPassword}
                    fullWidth
                />
                <Input
                    type="password"
                    label="New password"
                    bind:value={newPassword}
                    fullWidth
                />
                <Input
                    type="password"
                    label="Confirm new password"
                    bind:value={confirmPassword}
                    fullWidth
                />
            </div>
            <div class="password-actions">
                <Button
                    variant="secondary"
                    onclick={handleChangePassword}
                    disabled={savingPassword ||
                        !currentPassword ||
                        !newPassword ||
                        !confirmPassword}
                >
                    Change password
                </Button>
            </div>
        </section>
    {/if}

    {#snippet footer()}
        <Button variant="ghost" onclick={handleClose}>Cancel</Button>
        <Button
            variant="primary"
            onclick={handleSaveSettings}
            disabled={savingSettings || !$auth.user}
        >
            Save changes
        </Button>
    {/snippet}
</Modal>

<DeleteConfirmModal
    show={showDeleteAvatarModal}
    title="Remove Profile Picture"
    message="Are you sure you want to remove your profile picture? This action cannot be undone."
    onClose={() => (showDeleteAvatarModal = false)}
    onConfirm={handleAvatarDelete}
/>

<style>
    .hero {
        display: flex;
        gap: var(--space-4);
        align-items: center;
        margin-bottom: var(--space-5);
    }

    .avatar-editor {
        width: 72px;
        height: 72px;
        border-radius: 999px;
        border: 1px solid var(--border-primary);
        position: relative;
        overflow: hidden;
        flex-shrink: 0;
        background: var(--surface-secondary);
    }

    .avatar-fallback {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        font-size: var(--text-2xl);
        font-weight: var(--font-semibold);
        color: var(--text-secondary);
    }

    .avatar-fallback-hidden {
        opacity: 0;
    }

    .avatar-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
    }

    .avatar-image-loaded {
        opacity: 1;
    }

    .avatar-overlay {
        position: absolute;
        inset: 0;
        background: color-mix(in srgb, #000 48%, transparent);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        opacity: 0;
        transition: opacity var(--transition-fast);
    }

    .avatar-editor:hover .avatar-overlay,
    .avatar-editor:focus-within .avatar-overlay {
        opacity: 1;
    }

    .avatar-action {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, white 72%, transparent);
        background: color-mix(in srgb, white 16%, transparent);
        color: white;
        display: grid;
        place-items: center;
        cursor: pointer;
    }

    .avatar-action:hover:not(:disabled) {
        background: color-mix(in srgb, white 26%, transparent);
    }

    .avatar-action:disabled {
        opacity: 0.65;
        cursor: not-allowed;
    }

    .avatar-action-danger {
        border-color: color-mix(in srgb, var(--color-error) 75%, white);
        background: color-mix(in srgb, var(--color-error) 35%, transparent);
    }

    .avatar-action-danger:hover:not(:disabled) {
        background: color-mix(in srgb, var(--color-error) 50%, transparent);
    }

    .hidden-file-input {
        display: none;
    }

    .hero-meta h2 {
        margin: 0;
        color: var(--text-primary);
        font-size: 40px;
        font-family: "DM Serif Display", Georgia, serif;
        letter-spacing: -0.015em;
    }

    .hero-meta p {
        margin: 0;
        color: var(--text-secondary);
        font-size: var(--text-sm);
    }

    .section {
        border-top: 1px solid var(--border-primary);
        padding-top: var(--space-4);
        margin-top: var(--space-4);
    }

    .section h3 {
        margin: 0 0 var(--space-3);
        font-size: var(--text-lg);
    }

    .fields {
        display: grid;
        gap: var(--space-3);
    }

    .password-actions {
        margin-top: var(--space-4);
        display: flex;
        justify-content: flex-end;
    }
</style>
