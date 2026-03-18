<script lang="ts">
    import { tick } from "svelte";
    import X from "@lucide/svelte/icons/x";
    import Pencil from "@lucide/svelte/icons/pencil";
    import PencilLine from "@lucide/svelte/icons/pencil-line";
    import Trash2 from "@lucide/svelte/icons/trash-2";
    import { auth } from "$lib/stores/auth";
    import { notifications } from "$lib/stores/notifications";
    import { usersApi } from "$lib/services/api";
    import { getProfilePicUrl } from "$lib/utils/urls";
    import Button from "./Button.svelte";
    import Input from "./Input.svelte";
    import Modal from "./Modal.svelte";
    import IconButton from "./IconButton.svelte";
    import Tooltip from "./Tooltip.svelte";
    import DeleteConfirmModal from "$lib/components/editor/DeleteConfirmModal.svelte";

    interface UserSettingsModalProps {
        open?: boolean;
        onClose?: () => void;
    }

    let { open = $bindable(false), onClose }: UserSettingsModalProps = $props();

    let savingName = $state(false);
    let savingPassword = $state(false);
    let savingAvatar = $state(false);
    let avatarLoaded = $state(false);
    let showDeleteAvatarModal = $state(false);
    let isEditingName = $state(false);
    let displayNameDraft = $state("");
    let initialNameForEdit = $state("");
    let avatarRefreshKey = $state(0);

    let currentPassword = $state("");
    let newPassword = $state("");
    let confirmPassword = $state("");

    let fileInput: HTMLInputElement | undefined = $state();
    let displayNameInput: HTMLInputElement | undefined = $state();
    let nameRowElement: HTMLDivElement | undefined = $state();
    let previousOpen = false;
    let previousUserId: number | null = null;

    function resetForm() {
        displayNameDraft = $auth.user?.username || "";
        initialNameForEdit = displayNameDraft;
        isEditingName = false;
        currentPassword = "";
        newPassword = "";
        confirmPassword = "";
        avatarLoaded = false;
        avatarRefreshKey = Date.now();
    }

    $effect(() => {
        const currentUserId = $auth.user?.id ?? null;

        // Reset only when the modal opens, or when the signed-in user changes.
        if (open && (!previousOpen || previousUserId !== currentUserId)) {
            resetForm();
        }

        previousOpen = open;
        previousUserId = currentUserId;
    });

    function profilePicSrc() {
        if (!$auth.user?.id) return "";
        return `${getProfilePicUrl($auth.user.id)}?v=${avatarRefreshKey}`;
    }

    function joinedOn(dateString: string) {
        return new Date(dateString).toLocaleDateString();
    }

    function handleClose() {
        open = false;
        onClose?.();
    }

    async function startNameEdit() {
        if (savingName) return;
        initialNameForEdit = $auth.user?.username || "";
        displayNameDraft = initialNameForEdit;
        isEditingName = true;
        await tick();
        displayNameInput?.focus();
        const end = displayNameInput?.value.length ?? 0;
        displayNameInput?.setSelectionRange(end, end);
    }

    function cancelNameEdit() {
        displayNameDraft = initialNameForEdit;
        isEditingName = false;
    }

    async function commitNameEdit() {
        if (!isEditingName || savingName || !$auth.user) return;

        const trimmedName = displayNameDraft.trim();
        if (!trimmedName) {
            displayNameDraft = initialNameForEdit;
            isEditingName = false;
            notifications.show("Display name cannot be empty", "error", 2500);
            return;
        }

        if (trimmedName === initialNameForEdit) {
            isEditingName = false;
            return;
        }

        savingName = true;
        try {
            const updatedUser = await usersApi.updateMe({
                username: trimmedName,
            });
            auth.setUser(updatedUser);
            displayNameDraft = updatedUser.username;
            initialNameForEdit = updatedUser.username;
            notifications.show("Display name updated", "info", 2000);
        } catch (error: any) {
            displayNameDraft = initialNameForEdit;
            notifications.show(
                error?.response?.data?.detail ||
                    "Failed to update display name",
                "error",
            );
        } finally {
            isEditingName = false;
            savingName = false;
        }
    }

    // Commit edits when clicking outside of the name editor controls.
    $effect(() => {
        if (!isEditingName) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (target && nameRowElement?.contains(target)) return;
            void commitNameEdit();
        };

        window.addEventListener("pointerdown", handlePointerDown, true);
        return () =>
            window.removeEventListener("pointerdown", handlePointerDown, true);
    });

    function handleDisplayNameKeydown(event: KeyboardEvent) {
        // Keep keystrokes inside the field so page-level shortcuts don't steal focus.
        event.stopPropagation();

        if (event.key === "Escape") {
            event.preventDefault();
            cancelNameEdit();
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            void commitNameEdit();
        }
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
            avatarRefreshKey = Date.now();
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
            avatarRefreshKey = Date.now();
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

<Modal bind:open size="md" hideCloseButton onClose={handleClose}>
    {#if $auth.user}
        <div class="content-root">
            <div class="top-actions">
                <Tooltip text="Close" position="top">
                    <IconButton
                        variant="flat"
                        icon={X}
                        size="md"
                        onclick={handleClose}
                        ariaLabel="Close settings"
                    />
                </Tooltip>
            </div>

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
                        <Tooltip text="Change profile picture" position="top">
                            <button
                                type="button"
                                class="avatar-action"
                                onclick={openFileBrowser}
                                disabled={savingAvatar}
                                aria-label="Change profile picture"
                            >
                                <Pencil size={15} />
                            </button>
                        </Tooltip>
                        {#if avatarLoaded}
                            <Tooltip
                                text="Remove profile picture"
                                position="top"
                            >
                                <button
                                    type="button"
                                    class="avatar-action avatar-action-danger"
                                    onclick={askDeleteAvatar}
                                    disabled={savingAvatar}
                                    aria-label="Remove profile picture"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </Tooltip>
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
                    <div class="name-row" bind:this={nameRowElement}>
                        {#if isEditingName}
                            <input
                                bind:this={displayNameInput}
                                class="display-name-input"
                                bind:value={displayNameDraft}
                                onkeydown={handleDisplayNameKeydown}
                                onclick={(event) => event.stopPropagation()}
                                maxlength="50"
                            />
                        {:else}
                            <button
                                type="button"
                                class="display-name-button"
                                onclick={startNameEdit}
                                disabled={savingName}
                                title="Edit display name"
                            >
                                {$auth.user.username}
                            </button>
                            <Tooltip text="Edit display name" position="top">
                                <button
                                    type="button"
                                    class="edit-name-btn"
                                    onclick={startNameEdit}
                                    disabled={savingName}
                                    aria-label="Edit display name"
                                >
                                    <PencilLine size={20} />
                                </button>
                            </Tooltip>
                        {/if}
                    </div>
                    <p class="hero-email">{$auth.user.email}</p>
                    <p>Member since {joinedOn($auth.user.created_at)}</p>
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
        </div>
    {/if}
</Modal>

<DeleteConfirmModal
    show={showDeleteAvatarModal}
    title="Remove Profile Picture"
    message="Are you sure you want to remove your profile picture? This action cannot be undone."
    onClose={() => (showDeleteAvatarModal = false)}
    onConfirm={handleAvatarDelete}
/>

<style>
    .content-root {
        position: relative;
        padding-top: 0;
        padding: 1rem 1rem;
    }

    .top-actions {
        position: absolute;
        top: 0;
        right: 0;
        z-index: 1;
    }

    .hero {
        display: flex;
        gap: var(--space-4);
        align-items: flex-start;
        margin: 0;
        padding-right: 40px;
    }

    .avatar-editor {
        width: 90px;
        height: 90px;
        border-radius: 999px;
        border: 1px solid var(--text-tertiary);
        position: relative;
        overflow: hidden;
        flex-shrink: 0;
        background: var(--bg-file-panel);
    }

    .avatar-editor:hover {
        border: 1px solid var(--text-primary);
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
        background: var(--surface-active);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.1rem;
        opacity: 0;
        transition: none;
    }

    .avatar-editor:hover .avatar-overlay,
    .avatar-editor:focus-within .avatar-overlay {
        opacity: 1;
    }

    .avatar-action {
        width: 35px;
        height: 35px;
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

    .hero-meta {
        min-width: 0;
        gap: 4px;
        display: flex;
        flex-direction: column;
    }

    .name-row {
        display: flex;
        align-items: flex-end;
        gap: var(--space-1);
        min-height: 46px;
    }

    .display-name-button,
    .display-name-input {
        margin: 0;
        color: var(--text-primary);
        font-size: 40px;
        font-family: "DM Serif Display", Georgia, serif;
        letter-spacing: -0.015em;
        line-height: 1;
        height: 40px;
        box-sizing: border-box;
        padding: 0;
    }

    .display-name-input {
        border: none;
        background: transparent;
        outline: none;
        appearance: none;
        -webkit-appearance: none;
        width: min(420px, calc(100vw - 220px));
        display: block;
    }

    .display-name-button {
        border: 1px solid transparent;
        background: transparent;
        text-align: left;
        cursor: pointer;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: min(420px, calc(100vw - 220px));
    }

    .display-name-button:hover:not(:disabled),
    .display-name-button:focus-visible {
        outline: 2px solid var(--color-primary-500);
        outline-offset: 2px;
        border-radius: var(--radius-sm);
    }

    .display-name-button:disabled {
        cursor: default;
        opacity: 0.85;
    }

    .edit-name-btn {
        width: 28px;
        height: 28px;
        align-self: flex-end;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--text-secondary);
        display: grid;
        place-items: center;
        cursor: pointer;
        transform: translateY(-2px);
    }

    .edit-name-btn:hover:not(:disabled) {
        background: var(--surface-hover);
        color: var(--text-primary);
    }

    .edit-name-btn:active:not(:disabled) {
        background: var(--surface-active);
    }

    .edit-name-btn:disabled {
        opacity: 0.65;
        cursor: not-allowed;
    }

    /* .hero-email {
        margin: 0;
        color: red;
        font-size: var(--text-md);
    } */

    .hero-meta p {
        margin: 0;
        color: var(--text-secondary);
        font-size: var(--text-md);
    }

    .section {
        border-top: 1px solid var(--border-primary);
        padding-top: var(--space-4);
        margin-top: var(--space-4);
    }

    .section h3 {
        margin: 0 0 var(--space-3);
        font-size: 1.5rem;
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
