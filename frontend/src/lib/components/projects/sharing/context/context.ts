// Manager of the share dialog.
//
// A sub-context of the projects region rather than part of the editor context:
// the same dialog is opened from the dashboard (per project card) and from the
// editor's top bar, and it owns nothing the editor needs. The project it acts
// on is held here, so no component ever passes a project down as a prop.

import { derived, get, writable } from "svelte/store";
import { invitationsApi, projectsApi, sharingApi } from "$lib/services/api";
import { notifications } from "$lib/stores/notifications";
import type {
  Collaborator,
  CollaboratorRole,
  Project,
  ShareLinksSummary,
  SharingOverview,
} from "$lib/types";
import { errorMessage } from "../../context";

export type PublicLinkType = "read" | "comment" | "edit";

export const COLLABORATOR_ROLES: { value: CollaboratorRole; label: string }[] = [
  { value: "reader", label: "Reader" },
  { value: "commentor", label: "Commentor" },
  { value: "writer", label: "Writer" },
  { value: "admin", label: "Admin" },
];

/* ------------------------------------------------------------------ state */

/** The project the dialog is sharing, or `null` when it is closed. */
export const shareProject = writable<Project | null>(null);
export const sharingOverview = writable<SharingOverview | null>(null);
export const sharingLoading = writable(false);
export const sharingError = writable<string | null>(null);
/** Set while a mutation is in flight, so the dialog can disable its controls. */
export const sharingBusy = writable(false);

const EMPTY_LINKS: ShareLinksSummary = { read: null, comment: null, edit: null };

export const publicLinks = derived(
  sharingOverview,
  ($overview) => $overview?.public_links ?? EMPTY_LINKS,
);

export const pendingInvitations = derived(
  sharingOverview,
  ($overview) => $overview?.invitations ?? [],
);

/** Owner + admin may manage links, roles and invitations. */
export const canManageSharing = derived(shareProject, ($project) => {
  const role = $project?.current_user_role;
  return role === "owner" || role === "admin";
});

/** Which link types the current role is even allowed to see, let alone hand
 * out: you cannot share more access than you have. */
export const visibleLinkTypes = derived(shareProject, ($project) => {
  const role = $project?.current_user_role;
  const types: { key: PublicLinkType; label: string }[] = [
    { key: "read", label: "Read-only" },
  ];
  if (role !== "reader") types.push({ key: "comment", label: "Comment" });
  if (role === "owner" || role === "admin" || role === "writer") {
    types.push({ key: "edit", label: "Edit" });
  }
  return types;
});

/**
 * The member list. The backend does not always return the owner as a
 * collaborator row, so it is synthesised from `project.owner` when missing —
 * otherwise the dialog shows a project with no owner.
 */
export const members = derived(
  [shareProject, sharingOverview],
  ([$project, $overview]): Collaborator[] => {
    if (!$overview || !$project) return [];
    const collaborators = $overview.collaborators;
    const owner = $project.owner;
    if (!owner) return collaborators;

    const alreadyListed = collaborators.some(
      (c) => c.user_id === owner.id || c.role === "owner",
    );
    if (alreadyListed) return collaborators;

    const synthetic: Collaborator = {
      id: `owner-${owner.id}`,
      project_id: $project.id,
      user_id: owner.id,
      role: "owner",
      created_at: $project.created_at,
      updated_at: $project.updated_at,
      user: {
        id: owner.id,
        display_name: owner.display_name,
        user_type: "auth",
        email: owner.email ?? "",
        is_active: true,
        is_superuser: false,
        created_at: $project.created_at,
        updated_at: $project.updated_at,
      },
    };
    return [synthetic, ...collaborators];
  },
);

/* ------------------------------------------------------------- primitives */

export function openShareDialog(project: Project | null): void {
  if (!project) return;
  shareProject.set(project);
  sharingOverview.set(null);
  sharingError.set(null);
  void loadSharingOverview();
}

export function closeShareDialog(): void {
  shareProject.set(null);
  sharingOverview.set(null);
  sharingError.set(null);
}

export async function loadSharingOverview(): Promise<void> {
  const project = get(shareProject);
  if (!project) return;

  sharingLoading.set(true);
  sharingError.set(null);
  try {
    sharingOverview.set(await sharingApi.getOverview(project.id));
  } catch (error) {
    sharingError.set(errorMessage(error, "Failed to load sharing settings"));
  } finally {
    sharingLoading.set(false);
  }
}

/** Every mutation reloads the overview, which is the server's own view of the
 * result — no optimistic local edits to keep in sync. */
async function mutate(
  action: () => Promise<unknown>,
  failureMessage: string,
): Promise<boolean> {
  if (!get(canManageSharing) || get(sharingBusy)) return false;
  sharingBusy.set(true);
  try {
    await action();
    await loadSharingOverview();
    return true;
  } catch (error) {
    notifications.show(errorMessage(error, failureMessage), "error", 5000);
    return false;
  } finally {
    sharingBusy.set(false);
  }
}

export async function createPublicLink(linkType: PublicLinkType): Promise<void> {
  const project = get(shareProject);
  if (!project) return;
  await mutate(
    () => sharingApi.createPublicLink(project.id, linkType),
    "Failed to create the link",
  );
}

export async function revokePublicLink(linkType: PublicLinkType): Promise<void> {
  const project = get(shareProject);
  if (!project) return;
  await mutate(
    () => sharingApi.revokePublicLink(project.id, linkType),
    "Failed to revoke the link",
  );
}

/** Share links come back as site-relative paths; the clipboard needs the
 * absolute URL. */
export function absoluteShareUrl(relativePath: string): string {
  if (typeof window === "undefined") return relativePath;
  return new URL(relativePath, window.location.origin).toString();
}

export async function copyShareLink(relativePath: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(absoluteShareUrl(relativePath));
    notifications.show("Link copied to clipboard", "info", 2000);
  } catch {
    notifications.show("Failed to copy the link", "error", 2500);
  }
}

export async function updateMemberRole(
  userId: string,
  role: CollaboratorRole,
): Promise<void> {
  const project = get(shareProject);
  if (!project) return;
  await mutate(
    () => projectsApi.updateCollaborator(project.id, userId, role),
    "Failed to change the role",
  );
}

export async function removeMember(userId: string): Promise<void> {
  const project = get(shareProject);
  if (!project) return;
  const ok = await mutate(
    () => projectsApi.removeCollaborator(project.id, userId),
    "Failed to remove the collaborator",
  );
  if (ok) notifications.show("Collaborator removed", "info", 2000);
}

export async function sendInvitation(
  email: string,
  role: CollaboratorRole,
): Promise<boolean> {
  const project = get(shareProject);
  const trimmed = email.trim();
  if (!project || !trimmed) return false;
  const ok = await mutate(
    () => invitationsApi.send(project.id, trimmed, role),
    "Failed to send the invitation",
  );
  if (ok) notifications.show("Invitation sent", "info", 3000);
  return ok;
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  const project = get(shareProject);
  if (!project) return;
  await mutate(
    () => invitationsApi.cancel(project.id, invitationId),
    "Failed to cancel the invitation",
  );
}
