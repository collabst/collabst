import { goto } from "$app/navigation";
import { projectsApi } from "$lib/services/api";
import { auth } from "$lib/stores/auth";
import { notifications } from "$lib/stores/notifications";
import { type Comment, type Project } from "$lib/types";
import { loadCommentsForSelectedFile } from "../comments";
import {
  canManageProject,
  currentUserRole,
  files,
  project,
  projectId,
  selectedFile,
} from "../state";
import { destroyRealtimeConnections, initRealtimeConnections } from "./realtime";
import { tick } from "svelte";
import { get } from "svelte/store";
/**
 * Loading the project, renaming it, and reacting to a permission change the
 * server pushes mid-session.
 */

let isRefreshingPermissions = false;
let isResettingRealtime = false;

export async function resetRealtimeConnectionsForWriteLoss() {
  if (isResettingRealtime) return;
  isResettingRealtime = true;

  try {
    const selectedFileId = get(selectedFile)?.id ?? null;

    // Drop old Yjs doc/provider state so unsynced edits cannot be replayed later.
    destroyRealtimeConnections();
    initRealtimeConnections();

    // Force file reselection so the rebuilt editor instance reopens the current file.
    if (selectedFileId) {
      const reopenedFile = get(files).find((file) => file.id === selectedFileId) || null;
          await tick();
      selectedFile.set(reopenedFile);
    }

    await loadCommentsForSelectedFile();
  } finally {
    isResettingRealtime = false;
  }
}

/**
 * Rename the open project. Returns `true` when the name actually changed, so
 * the top bar can leave its inline editor open on failure.
 */
export async function renameProject(newName: string): Promise<boolean> {
  if (!get(canManageProject)) return false;

  const current = get(project);
  const trimmed = newName.trim();
  if (!current || !trimmed || trimmed === current.name) return true;

  try {
    project.set(await projectsApi.update(current.id, trimmed));
    return true;
  } catch (error) {
    console.error("Failed to rename project:", error);
    const message =
      (error as any)?.response?.data?.detail || "Failed to rename project";
    notifications.show(message, "error", 5000);
    return false;
  }
}

export async function loadProject(): Promise<boolean> {
  try {
    project.set(await projectsApi.get(get(projectId)));
    currentUserRole.set((get(project)?.current_user_role || "reader"));
    return true;
  } catch (error) {
    console.error("Failed to load project:", error);
    const status = (error as any)?.response?.status;
    if (status === 404 || status === 403) {
      notifications.show("Project not found", "error", 5000);
      if (get(auth).user?.user_type === "guest") {
        goto("/login", { replaceState: true });
      } else {
        goto("/");
      }
    }
    return false;
  }
}

export async function handlePermissionSignal(
  signal:
    | string
    | {
      reason: string;
      action?: "role_updated" | "removed_from_project";
      newRole?: "owner" | "admin" | "writer" | "commentor" | "reader";
    },
) {
  if (isRefreshingPermissions) return;
  isRefreshingPermissions = true;

  const normalized = typeof signal === "string" ? { reason: signal } : signal;
  const reason = normalized.reason;
  const action = normalized.action;
  const newRole = normalized.newRole;

  const hadWrite = ["owner", "admin", "writer"].includes(get(currentUserRole));
  const hadComment = ["owner", "admin", "writer", "commentor"].includes(get(currentUserRole));

  try {
    const nextCanWriteFromRole = (role: string) => ["owner", "admin", "writer"].includes(role);
    const nextCanCommentFromRole = (role: string) => nextCanWriteFromRole(role) || role === "commentor";

    const hasImmediateRoleUpdate = action === "removed_from_project" || !!newRole;

    if (project && action === "removed_from_project") {
      project.update((p) => p ? { ...p, current_user_role: "reader" } : p);
      currentUserRole.set("reader");
    } else if (project && newRole) {
      project.update((p) => p ? { ...p, current_user_role: newRole } : p);
      currentUserRole.set(newRole);
    } else if (!project && newRole) {
      currentUserRole.set(newRole);
    }

    if (!hasImmediateRoleUpdate) {
      const loaded = await loadProject();
      if (!loaded) return;
    } else {
      // Reconcile with backend source of truth without delaying UI lock.
      void loadProject();
    }

    const resolvedRole = get(currentUserRole);
    const nextCanWrite = nextCanWriteFromRole(resolvedRole);
    const nextCanComment = nextCanCommentFromRole(resolvedRole);

    if (hadWrite && !nextCanWrite) {
          await resetRealtimeConnectionsForWriteLoss();
      notifications.show(
        reason || "Your write access was removed. Editor switched to read-only.",
        "warning",
        5000,
      );
      return;
    }

    if (hadComment && !nextCanComment) {
          notifications.show(
        reason || "Your comment access was removed. Comment inputs are disabled.",
        "warning",
        5000,
      );
      return;
    }

    notifications.show(reason || "Project permissions were updated.", "info", 3000);
  } finally {
    isRefreshingPermissions = false;
  }
}
