import { assetsApi, filesApi } from "$lib/services/api";
import { notifications } from "$lib/stores/notifications";
import { wireComments } from "./comments";
import { wireDiagnostics } from "./editor/diagnostics";
import { wireFind } from "./editor/find";
import { wireEditability, wireEditorExtensions } from "./editor/extensions";
import { setUndoManager, wireEditorView } from "./editor/view";
import { initSelectedFile, wireFiles } from "./files";
import { releaseAssetBlobUrls } from "./files/assets";
import { clearFileObservers } from "./files/observers";
import { resetIframeBridge } from "./preview/iframe";
import { closeSeparatePreviewOnTeardown } from "./preview/separateWindow";
import { disposeWorker, initWorker } from "./preview/worker";
import { loadProject } from "./project";
import {
  destroyRealtimeConnections,
  initRealtimeConnections,
  wireAwareness,
} from "./project/realtime";
import { wireSearch } from "./search";
import {
  assets,
  canComment,
  canManageProject,
  canWrite,
  currentUserRole,
  files,
  initError,
  project,
  projectId,
  resetState,
  type Disposer,
  view,
} from "./state";
import { get } from "svelte/store";
/**
 * The editor context's lifecycle.
 *
 * `initContext()` resets every store, wires the project-scoped reactions, and
 * opens the connections; `destroyContext()` unwinds that in reverse. Between
 * them the context is live; outside them nothing in `context/` is subscribed to
 * anything, which is what makes the module importable on the server.
 */

let contextGeneration = 0;

/**
 * Read by the slices whose async work can outlive a teardown (`editor/view`
 * awaits `createExtensions()`, `preview/worker` awaits asset bytes), where
 * disposal comes too late — the await is already in flight.
 */
export function getContextGeneration(): number {
  return contextGeneration;
}

/**
 * The project-scoped reactive wiring, live only between `initContext()` and
 * `destroyContext()`. Slices are wired in order and disposed in reverse, before
 * any store is reset, so teardown cannot replay reactions on a half-dead world.
 */
let disposeWiring: Disposer | null = null;

function wireContext(): Disposer {
  const disposers: Disposer[] = [
    wirePermissions(),
    wireAwareness(),
    wireEditorExtensions(),
    wireEditability(),
    wireEditorView(),
    wireDiagnostics(),
    wireFind(),
    wireFiles(),
    wireSearch(),
    wireComments(),
  ];
  return () => {
    for (const dispose of [...disposers].reverse()) dispose();
  };
}

export async function initContext(projectIdValue: string) {
  const generation = ++contextGeneration;

  // A previous project's wiring survives a remount without unmount; wiring
  // twice would double every reaction.
  disposeWiring?.();
  disposeWiring = null;

  // `resetState()` drops `selectedAssetUrl`, but the object URLs behind it have
  // to be revoked rather than dropped.
  releaseAssetBlobUrls();
  resetState();

  projectId.set(projectIdValue);

  // Only now: a reset must not drive reactions.
  disposeWiring = wireContext();

  // The route only leaves its "Loading…" screen once this resolves, so a
  // failure has to stop the sequence and surface through `initError`.
  try {
    const loaded = await loadProject();
    if (generation !== contextGeneration) return;
    if (!loaded) {
      // `loadProject()` shows its own notification and navigates away on 404/403.
      initError.set("This project could not be opened.");
      return;
    }
    initRealtimeConnections();
    const newFiles = await filesApi.list(projectIdValue);
    if (generation !== contextGeneration) return;
    files.update(() => newFiles);
    const newAssets = await assetsApi.list(projectIdValue);
    if (generation !== contextGeneration) return;
    assets.set(newAssets);
    await initSelectedFile();
    if (generation !== contextGeneration) return;
    initWorker();
  } catch (error) {
    if (generation !== contextGeneration) return;
    console.error("Failed to open the project:", error);
    const detail = errorDetail(error, "This project could not be opened.");
    initError.set(detail);
    notifications.show(detail, "error", 5000);
  }
}

export function errorDetail(error: unknown, fallback: string) {
  return (error as any)?.response?.data?.detail || fallback;
}

/** Derive the three permission flags from the role the server reports. */
export function wirePermissions(): Disposer {
  return currentUserRole.subscribe((role) => {
    canWrite.set(["owner", "admin", "writer"].includes(role));
    canComment.set(["owner", "admin", "writer", "commentor"].includes(role));
    canManageProject.set(["owner", "admin"].includes(role));
  });
}

export function destroyContext() {
  contextGeneration++;

  // Before anything is reset, so the resets cannot drive reactions.
  disposeWiring?.();
  disposeWiring = null;

  destroyRealtimeConnections();

  // Otherwise the popup outlives the route, listening for a dead stream.
  closeSeparatePreviewOnTeardown();

  disposeWorker();
  resetIframeBridge();

  get(view)?.destroy();
  view.set(null);

  setUndoManager(null);

  clearFileObservers();
  releaseAssetBlobUrls();

  resetState();
}
