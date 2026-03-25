<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import Link2 from "@lucide/svelte/icons/link-2";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import SendHorizontal from "@lucide/svelte/icons/send-horizontal";
  import Users from "@lucide/svelte/icons/users";
  import X from "@lucide/svelte/icons/x";
  import Tooltip from "$lib/components/ui/Tooltip.svelte";
  import DropdownSettingsButton from "$lib/components/ui/DropdownSettingsButton.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import { notifications } from "$lib/stores/notifications";
  import type {
    CollaboratorRole,
    Project,
    ShareLinksSummary,
    SharingOverview,
  } from "$lib/types";
  import { invitationsApi, projectsApi, sharingApi } from "$lib/services/api";

  let {
    show = $bindable(false),
    project,
    onClose,
  } = $props<{
    show?: boolean;
    project: Project;
    onClose?: () => void;
  }>();

  let loading = $state(false);
  let error = $state<string | null>(null);
  let overview = $state<SharingOverview | null>(null);

  let inviteEmail = $state("");
  let inviteRole = $state<CollaboratorRole>("writer");
  let inviteLoading = $state(false);

  type PublicLinkType = "read" | "comment" | "edit";

  const canManage = $derived(
    project.current_user_role === "owner" ||
      project.current_user_role === "admin",
  );
  const publicLinks = $derived<ShareLinksSummary>(
    overview?.public_links ?? { read: null, comment: null, edit: null },
  );
  const canSeeCommentLink = $derived(project.current_user_role !== "reader");
  const canSeeEditLink = $derived(
    project.current_user_role === "owner" ||
      project.current_user_role === "admin" ||
      project.current_user_role === "writer",
  );
  const visibleLinkTypes = $derived([
    { key: "read", label: "Read-only" },
    ...(canSeeCommentLink ? [{ key: "comment", label: "Comment-only" }] : []),
    ...(canSeeEditLink ? [{ key: "edit", label: "Edit" }] : []),
  ] as { key: PublicLinkType; label: string }[]);
  const collaboratorRoleOptions = [
    { value: "reader", label: "Reader" },
    { value: "commentor", label: "Commentor" },
    { value: "writer", label: "Writer" },
    { value: "admin", label: "Admin" },
  ];

  const members = $derived.by(() => {
    if (!overview) return [];
    const ownerId = project.owner?.id;
    const ownerExists =
      !!ownerId &&
      overview.collaborators.some(
        (c) => c.user_id === ownerId || c.role === "owner",
      );

    if (ownerExists || !project.owner) {
      return overview.collaborators;
    }

    return [
      {
        id: 0,
        project_id: project.id,
        user_id: project.owner.id,
        role: "owner" as CollaboratorRole,
        created_at: project.created_at,
        updated_at: project.updated_at,
        user: {
          id: project.owner.id,
          email: project.owner.email,
          username: project.owner.username,
          is_active: true,
          is_superuser: false,
          created_at: project.created_at,
          updated_at: project.updated_at,
        },
      },
      ...overview.collaborators,
    ];
  });

  async function loadOverview() {
    loading = true;
    error = null;
    try {
      overview = await sharingApi.getOverview(project.id);
    } catch (err: any) {
      error = err?.response?.data?.detail || "Failed to load sharing settings";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (show) {
      loadOverview();
    }
  });

  $effect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    show = false;
    onClose?.();
  }

  function getAbsoluteUrl(relativePath: string): string {
    if (typeof window === "undefined") return relativePath;
    return `${window.location.origin}${relativePath}`;
  }

  async function createLink(linkType: "read" | "comment" | "edit") {
    if (!canManage) return;
    await sharingApi.createPublicLink(project.id, linkType);
    await loadOverview();
  }

  async function revokeLink(linkType: "read" | "comment" | "edit") {
    if (!canManage) return;
    await sharingApi.revokePublicLink(project.id, linkType);
    await loadOverview();
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(getAbsoluteUrl(url));
      notifications.show("Link copied to clipboard", "info", 2000);
    } catch {
      notifications.show("Failed to copy link", "error", 2500);
    }
  }

  async function sendInvitation() {
    if (!canManage) return;
    if (!inviteEmail.trim()) return;
    inviteLoading = true;
    try {
      await invitationsApi.send(project.id, inviteEmail.trim(), inviteRole);
      inviteEmail = "";
      inviteRole = "writer";
      await loadOverview();
    } finally {
      inviteLoading = false;
    }
  }

  async function updateMemberRole(userId: string, role: CollaboratorRole) {
    if (!canManage) return;
    await projectsApi.updateCollaborator(project.id, userId, role);
    await loadOverview();
  }

  async function removeMember(userId: string) {
    if (!canManage) return;
    await projectsApi.removeCollaborator(project.id, userId);
    await loadOverview();
  }

  async function cancelInvitation(invitationId: string) {
    if (!canManage) return;
    await invitationsApi.cancel(project.id, invitationId);
    await loadOverview();
  }
</script>

{#if show}
  <div class="overlay" onclick={close} role="presentation">
    <div
      class="dialog"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <header class="dialog-header">
        <h2>Share project</h2>
        <IconButton
          variant="flat"
          icon={X}
          size="md"
          onclick={close}
          ariaLabel="Close share dialog"
        />
      </header>

      {#if loading}
        <div class="state">Loading sharing settings…</div>
      {:else if error}
        <div class="state error">{error}</div>
      {:else if overview}
        <section class="section">
          <h3><Link2 size={16} /> Public link</h3>
          {#each visibleLinkTypes as linkType}
            {@const link = publicLinks[linkType.key]}
            <div class="link-row">
              <div class="link-label">{linkType.label}</div>
              {#if link}
                <input readonly value={getAbsoluteUrl(link.url)} />
                <Tooltip text="Copy link" position="top">
                  <button
                    class="icon-btn"
                    type="button"
                    onclick={() => copyLink(link.url)}
                    aria-label="Copy link"
                  >
                    <Copy size={14} />
                  </button>
                </Tooltip>
                {#if canManage}
                  <button
                    class="danger-btn"
                    type="button"
                    onclick={() => revokeLink(linkType.key)}>Revoke link</button
                  >
                {/if}
              {:else if canManage}
                <button
                  class="secondary-btn"
                  type="button"
                  onclick={() => createLink(linkType.key)}>Create link</button
                >
              {:else}
                <span class="muted">No link</span>
              {/if}
            </div>
          {/each}
        </section>

        {#if canManage}
          <section class="section">
            <h3><SendHorizontal size={16} /> Add collaborators</h3>
            <div class="invite-row">
              <input
                type="email"
                bind:value={inviteEmail}
                placeholder="collaborator@example.com"
                disabled={inviteLoading}
              />
              <div
                class="invite-role-dropdown"
                class:invite-role-dropdown-disabled={inviteLoading}
              >
                <DropdownSettingsButton
                  bind:value={inviteRole}
                  options={collaboratorRoleOptions}
                />
              </div>
              <button
                type="button"
                class="primary-btn"
                disabled={inviteLoading}
                onclick={sendInvitation}
              >
                Invite
              </button>
            </div>
            {#if overview.invitations.length === 0}
              <p class="muted">No pending invitations.</p>
            {:else}
              <div class="pending-list">
                {#each overview.invitations as invitation}
                  <div class="pending-item">
                    <span>{invitation.invitee_email} · {invitation.role}</span>
                    <Tooltip text="Cancel invitation" position="top">
                      <button
                        class="icon-btn"
                        type="button"
                        onclick={() => cancelInvitation(invitation.id)}
                        aria-label="Cancel invitation"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Tooltip>
                  </div>
                {/each}
              </div>
            {/if}
          </section>
        {/if}

        <section class="section">
          <h3><Users size={16} /> Project members</h3>
          {#if members.length === 0}
            <p class="muted">No collaborators yet.</p>
          {:else}
            <div class="member-list">
              {#each members as collaborator}
                {@const isOwner =
                  collaborator.role === "owner" ||
                  collaborator.user_id === project.owner_id}
                <div class="member-row">
                  <div class="member-info">
                    <strong
                      >{collaborator.user?.username ||
                        collaborator.user_id}</strong
                    >
                    <span>{collaborator.user?.email}</span>
                  </div>
                  {#if canManage && !isOwner}
                    <div class="member-role-dropdown">
                      <DropdownSettingsButton
                        value={collaborator.role}
                        options={collaboratorRoleOptions}
                        onchange={(value) =>
                          updateMemberRole(
                            collaborator.user_id,
                            value as CollaboratorRole,
                          )}
                      />
                    </div>
                    <button
                      class="danger-btn"
                      type="button"
                      onclick={() => removeMember(collaborator.user_id)}
                      >Remove</button
                    >
                  {:else}
                    <span class="muted role-pill"
                      >{isOwner ? "owner" : collaborator.role}</span
                    >
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: var(--dialog-backdrop);
    backdrop-filter: blur(var(--dialog-backdrop-blur));
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: var(--z-modal-backdrop);
    padding: var(--space-4);
  }

  .dialog {
    width: min(920px, 100%);
    max-height: 85vh;
    overflow: auto;
    background: var(--dialog-bg);
    border: 2px solid var(--dialog-border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-2xl);
    padding: 1.75rem 2rem 1.5rem 2rem;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-4);
  }

  h2 {
    margin: 0;
    color: var(--dialog-text);
    font-size: 2.3rem;
    letter-spacing: -0.02em;
    font-family: "DM Serif Display", Georgia, serif;
  }

  .section {
    margin-bottom: var(--space-5);
    background-color: color-mix(in srgb, var(--bg-editor), transparent 55%);
    border-radius: var(--radius-xl);
    padding: var(--space-5) var(--space-6);
  }

  h3 {
    margin: 0 0 var(--space-4) 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-secondary);
    letter-spacing: -0.02em;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .link-row,
  .invite-row,
  .member-row,
  .pending-item {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    margin-bottom: var(--space-2);
  }

  .link-label {
    width: 110px;
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .member-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .member-info span {
    color: var(--text-secondary);
    font-size: var(--text-xs);
  }

  input {
    min-height: 34px;
    border-radius: var(--radius-md);
    color: var(--text-primary);
    padding: var(--space-2) var(--space-2);
  }

  input {
    background: var(--bg-primary);
    border: 2px solid var(--border-primary);
  }

  input:hover {
    border-color: var(--border-secondary);
  }

  input:focus {
    outline: none;
    border-color: var(--color-tertiary-500);
  }

  input:read-only {
    border: 2px solid var(--border-primary);
    background: none;
    color: var(--text-tertiary);
    opacity: 0.9;
  }

  .link-row input,
  .invite-row input {
    flex: 1;
  }

  .invite-role-dropdown,
  .member-role-dropdown {
    flex-shrink: 0;
  }

  .invite-role-dropdown {
    min-width: 130px;
  }

  .invite-role-dropdown-disabled {
    pointer-events: none;
    opacity: 0.65;
  }

  .invite-role-dropdown :global(.dropdown-btn),
  .member-role-dropdown :global(.dropdown-btn) {
    border-radius: var(--radius-md);
  }

  .primary-btn,
  .secondary-btn,
  .danger-btn,
  .icon-btn {
    border: none;
    border-radius: var(--radius-md);
    min-height: 34px;
    cursor: pointer;
    padding: 0 var(--space-3);
  }

  .primary-btn {
    background: var(--color-tertiary-500);
    border: 2px solid var(--color-tertiary-500);
    color: white;
  }

  .primary-btn:hover {
    background: var(--color-tertiary-glow);
    border-color: var(--color-tertiary-glow);
    box-shadow: 0 1px 6px var(--color-tertiary-glow);
  }

  .primary-btn:active {
    box-shadow: 0 1px 12px var(--color-tertiary-glow);
  }

  .secondary-btn {
    background: var(--bg-primary);
    border: 2px solid var(--border-primary);
    color: var(--text-primary);
  }

  .secondary-btn:hover {
    background: var(--surface-hover);
    border-color: var(--border-secondary);
  }

  .secondary-btn:active {
    color: var(--text-active);
    background: var(--surface-active);
    transform: scaleX(1.02) scaleY(0.98);
  }

  .icon-btn {
    background: transparent;
    color: var(--text-primary);
    padding: 0 0.5rem 0 0.5rem;
    margin-right: 2rem;
    scale: 1.2;
  }

  .icon-btn:hover {
    color: var(--color-primary-500);
  }

  .icon-btn:active {
    color: var(--color-primary-600);
    transform: scaleX(1.1) scaleY(0.95);
  }

  .danger-btn {
    background: var(--color-error);
    border: 2px solid var(--color-error);
    color: white;
  }

  .danger-btn:hover {
    background: var(--color-error-dark);
    border-color: var(--color-error-dark);
    box-shadow: 0 1px 8px var(--color-error-glow);
  }

  .danger-btn:active {
    box-shadow: 0 1px 16px var(--color-error-glow);
  }

  .state,
  .muted {
    color: var(--text-secondary);
    font-size: var(--text-sm);
    margin: 0;
  }

  .error {
    color: var(--status-error-text);
  }

  .pending-list,
  .member-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .role-pill {
    text-transform: capitalize;
  }
</style>
