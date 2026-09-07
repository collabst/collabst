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
 * Read by the slices whose async work can outlive a teardown — `editor/view`
 * awaits `createExtensions()`, `preview/worker` awaits asset bytes. Disposal
 * cannot solve that race (A10): the await is already in flight.
 */
export function getContextGeneration(): number {
  return contextGeneration;
}

// Set when `initContext` gives up, so the route can show why instead of an
// editor with no project behind it. Cleared at the start of every init.

/**
 * The project-scoped reactive wiring, live only between `initContext()` and
 * `destroyContext()`.
 *
 * Everything a slice's `wireX()` registers is torn down here *before* any store
 * is reset, so teardown cannot replay the reactive graph against a half-dead
 * world — see `PHASE2.md` §2.2 and §3.2. Slices are wired in order and disposed
 * in reverse.
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

  // A previous project's wiring can still be live if the route remounted
  // without unmounting; wiring twice would double every reaction. Silence it
  // before the resets, for the same reason `destroyContext()` does.
  disposeWiring?.();
  disposeWiring = null;

  // The single reset list both ends of the lifecycle share (`PHASE2.md` §3.7).
  // `releaseAssetBlobUrls()` is the one thing it cannot do: `selectedAssetUrl`
  // is a store, but the object URLs behind it have to be revoked, not dropped.
  releaseAssetBlobUrls();
  resetState();

  projectId.set(projectIdValue);

  // Wired only now: everything above is a reset, and the whole point of moving
  // these out of module scope is that a reset must not drive reactions.
  disposeWiring = wireContext();

  // Every request below can reject, and the route only leaves its "Loading…"
  // screen once this resolves — an unhandled rejection here used to hang the
  // editor forever with nothing but a console message. A failure stops the
  // sequence (there is no point opening sockets for a project we could not
  // read) and is reported through `initError` for the route to render.
  try {
    const loaded = await loadProject();
    if (generation !== contextGeneration) return;
    if (!loaded) {
      // `loadProject()` has already shown its own notification, and navigates
      // away on 404/403.
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

  // First, before anything is reset: silence the wiring, so the resets below
  // cannot drive reactions across a world that is half torn down.
  disposeWiring?.();
  disposeWiring = null;

  destroyRealtimeConnections();

  // A popup outlives the route otherwise, still listening for a stream that
  // will never come again.
  closeSeparatePreviewOnTeardown();

  disposeWorker();
  resetIframeBridge();

  get(view)?.destroy();
  view.set(null);

  setUndoManager(null);

  clearFileObservers();
  releaseAssetBlobUrls();

  // Exactly the list `initContext()` runs, and the only one: the two used to be
  // hand-maintained and had drifted apart by fifteen stores (`PHASE2.md` §2.5).
  resetState();
}
