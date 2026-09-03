// Manager of the projects dashboard.
//
// Same split as `editor/context`: every piece of dashboard state lives here as a
// store, every side effect (HTTP, localStorage, navigation) lives here as a
// primitive, and the components under `lib/components/projects/` only render
// stores and call primitives. The editor context is deliberately *not* reused —
// it is scoped to one open project and owns a Yjs connection this page has no
// business starting.

import { derived, get, writable } from "svelte/store";
import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { filesApi, invitationsApi, projectsApi } from "$lib/services/api";
import { notifications } from "$lib/stores/notifications";
import type { Invitation, Project } from "$lib/types";

export type ViewMode = "grid" | "list";
export type SortBy = "name" | "created" | "modified";

const VIEW_MODE_KEY = "dashboardViewMode";
const SORT_BY_KEY = "dashboardSortBy";

/* ------------------------------------------------------------------ state */

export const projects = writable<Project[]>([]);
export const projectsLoading = writable(true);
export const projectsError = writable<string | null>(null);

export const viewMode = writable<ViewMode>("grid");
export const sortBy = writable<SortBy>("modified");
export const searchQuery = writable("");

/** The list the views render: `projects`, filtered by `searchQuery` and
 * ordered by `sortBy`. */
export const visibleProjects = derived(
  [projects, searchQuery, sortBy],
  ([$projects, $searchQuery, $sortBy]) =>
    sortProjects(filterProjects($projects, $searchQuery), $sortBy),
);

/** True when a query is hiding projects, so the empty state can say why. */
export const isFiltering = derived(
  searchQuery,
  ($searchQuery) => $searchQuery.trim().length > 0,
);

function filterProjects(list: Project[], query: string): Project[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return list;
  return list.filter(
    (project) =>
      project.name.toLowerCase().includes(needle) ||
      project.description?.toLowerCase().includes(needle),
  );
}

function sortProjects(list: Project[], by: SortBy): Project[] {
  const sorted = [...list];
  switch (by) {
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "created":
      return sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    case "modified":
    default:
      return sorted.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
  }
}

/* ------------------------------------------------------------- primitives */

/** Load (or reload) the project list. Safe to call repeatedly. */
export async function loadProjects(): Promise<void> {
  projectsError.set(null);
  try {
    projects.set(await projectsApi.list());
  } catch (error) {
    const message = errorMessage(error, "Failed to load projects");
    projectsError.set(message);
    notifications.show(message, "error", 5000);
  } finally {
    projectsLoading.set(false);
  }
}

/** Entry point for the route: restores the saved view preferences, then loads. */
export async function initProjectsContext(): Promise<void> {
  projectsLoading.set(true);
  projects.set([]);
  projectsError.set(null);
  searchQuery.set("");
  myInvitations.set([]);
  restorePreferences();
  await Promise.all([loadProjects(), loadMyInvitations()]);
}

export function setViewMode(mode: ViewMode): void {
  viewMode.set(mode);
  if (browser) localStorage.setItem(VIEW_MODE_KEY, mode);
}

export function setSearchQuery(query: string): void {
  searchQuery.set(query);
}

export function clearSearchQuery(): void {
  searchQuery.set("");
}

export function setSortBy(by: SortBy): void {
  sortBy.set(by);
  if (browser) localStorage.setItem(SORT_BY_KEY, by);
}

/** Sorting a column that is already the sort key is a no-op, not a toggle —
 * the old dashboard had no ascending/descending switch either. */
export function sortByColumn(column: SortBy): void {
  if (get(sortBy) === column) return;
  setSortBy(column);
}

/* ----------------------------------------------------------------- helpers */

function restorePreferences(): void {
  if (!browser) return;
  const storedView = localStorage.getItem(VIEW_MODE_KEY);
  if (storedView === "grid" || storedView === "list") viewMode.set(storedView);
  const storedSort = localStorage.getItem(SORT_BY_KEY);
  if (storedSort === "name" || storedSort === "created" || storedSort === "modified") {
    sortBy.set(storedSort);
  }
}

/** The API errors are axios errors; the useful text is in `response.data.detail`. */
export function errorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

/** Relative day label used by the list view ("Today", "3 days ago", …). */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const days = Math.floor(
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

/* ------------------------------------------------------- create a project */

/** Seeded into every new project so the editor has something to compile. */
const STARTER_MAIN_TYP = "Hello world!\n#pagebreak()\nReHelloworld!";

export const createDialogOpen = writable(false);
export const creatingProject = writable(false);

export function openCreateDialog(): void {
  createDialogOpen.set(true);
}

export function closeCreateDialog(): void {
  createDialogOpen.set(false);
}

/**
 * Create a project, seed its entry point, and open it. The seeding is what the
 * dashboard stub did inline; the editor does not create `main.typ` itself, so a
 * project without it opens on an empty file list.
 */
export async function createProject(
  name: string,
  description: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed || get(creatingProject)) return;

  creatingProject.set(true);
  try {
    const project = await projectsApi.create(trimmed, description.trim() || undefined);
    try {
      await filesApi.create(project.id, "main.typ", STARTER_MAIN_TYP);
    } catch (error) {
      // The project exists; a missing entry point is recoverable from the file
      // panel, so this is a warning rather than a failure of the whole action.
      console.error("Failed to seed main.typ:", error);
      notifications.show(
        errorMessage(error, "Project created, but its main.typ could not be added"),
        "warning",
        5000,
      );
    }
    closeCreateDialog();
    notifications.show("Project created", "info", 2000);
    await goto(`/editor/${project.id}`);
  } catch (error) {
    notifications.show(
      errorMessage(error, "Failed to create project"),
      "error",
      5000,
    );
  } finally {
    creatingProject.set(false);
  }
}

/* ------------------------------------------------------- delete a project */

/** The project the confirmation dialog is asking about, or `null` when closed.
 * Held in the context because the row that asks and the dialog that confirms
 * are siblings. */
export const pendingDeletion = writable<Project | null>(null);
export const deletingProject = writable(false);

export function requestDeletion(project: Project): void {
  pendingDeletion.set(project);
}

export function cancelDeletion(): void {
  pendingDeletion.set(null);
}

export async function confirmDeletion(): Promise<void> {
  const project = get(pendingDeletion);
  if (!project || get(deletingProject)) return;

  deletingProject.set(true);
  try {
    await projectsApi.delete(project.id);
    projects.update((list) => list.filter((p) => p.id !== project.id));
    pendingDeletion.set(null);
    notifications.show("Project deleted", "info", 2000);
  } catch (error) {
    notifications.show(
      errorMessage(error, "Failed to delete project"),
      "error",
      5000,
    );
  } finally {
    deletingProject.set(false);
  }
}

/* -------------------------------------------- invitations addressed to me */

/** Invitations waiting for this user's answer, shown above the project list. */
export const myInvitations = writable<Invitation[]>([]);
export const answeringInvitation = writable<string | null>(null);

export async function loadMyInvitations(): Promise<void> {
  try {
    myInvitations.set(await invitationsApi.listPending());
  } catch (error) {
    // A dashboard without its invitations is still usable, so this failure is
    // logged rather than shown.
    console.error("Failed to load pending invitations:", error);
    myInvitations.set([]);
  }
}

async function answerInvitation(
  invitationId: string,
  answer: () => Promise<void>,
  failureMessage: string,
  successMessage: string,
): Promise<void> {
  if (get(answeringInvitation)) return;
  answeringInvitation.set(invitationId);
  try {
    await answer();
    myInvitations.update((list) => list.filter((i) => i.id !== invitationId));
    notifications.show(successMessage, "info", 2500);
  } catch (error) {
    notifications.show(errorMessage(error, failureMessage), "error", 5000);
  } finally {
    answeringInvitation.set(null);
  }
}

export async function acceptInvitation(invitationId: string): Promise<void> {
  await answerInvitation(
    invitationId,
    () => invitationsApi.accept(invitationId),
    "Failed to accept the invitation",
    "Invitation accepted",
  );
  // Accepting adds a project to the workspace; reload rather than reasoning
  // about what the server just granted.
  await loadProjects();
}

export async function declineInvitation(invitationId: string): Promise<void> {
  await answerInvitation(
    invitationId,
    () => invitationsApi.decline(invitationId),
    "Failed to decline the invitation",
    "Invitation declined",
  );
}
