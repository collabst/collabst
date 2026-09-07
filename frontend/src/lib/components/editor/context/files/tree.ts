import { type Asset, type FileTreeNode } from "$lib/types";
import { buildFileTree, flattenTree } from "$lib/utils/fileTree";
import {
  deleteAsset,
  deleteFile,
  moveAsset,
  moveFile,
  newFile,
  newFolder,
} from ".";
import {
  assets,
  canWrite,
  draggedNodeId,
  expandedFolders,
  fileMenu,
  files,
  pendingDeletion,
  renamingNodeId,
} from "../state";
import type {
  ExplorerNode,
  File,
  FileMenuState,
  PendingDeletion,
} from "../types";
import { derived, get } from "svelte/store";

/**
 * The explorer's own view of the project: the tree it renders, which folders
 * are open, and the transient state behind renaming, the context menu, the
 * delete confirmation and drag-and-drop.
 */

export function startRenaming(nodeId: string) {
  if (!get(canWrite)) return;
  renamingNodeId.set(nodeId);
}

export function stopRenaming() {
  renamingNodeId.set(null);
}

function assetAsTreeRow(asset: Asset): File & { kind: "asset" } {
  return {
    id: asset.id,
    project_id: asset.project_id,
    name: asset.filename,
    path: asset.path,
    parent_id: asset.parent_id,
    is_folder: false,
    created_at: asset.created_at,
    updated_at: asset.updated_at,
    kind: "asset",
  };
}

export const fileTree = derived([files, assets], ([$files, $assets]) =>
  buildFileTree([
    ...$files.map((file) => ({ ...file, kind: "file" as const })),
    ...$assets.map(assetAsTreeRow),
  ]) as ExplorerNode[],
);

export function toggleFolder(folderId: string) {
  expandedFolders.update((expanded) => {
    // A new Set, not a mutation: subscribers compare by reference.
    const next = new Set(expanded);
    if (next.has(folderId)) {
      next.delete(folderId);
    } else {
      next.add(folderId);
    }
    return next;
  });
}

export function expandFolders(folderIds: string[]) {
  if (folderIds.length === 0) return;
  expandedFolders.update((expanded) => {
    const next = new Set(expanded);
    for (const id of folderIds) next.add(id);
    return next;
  });
}

// What the panel actually renders: the tree flattened to a list, collapsed
// folders' children dropped. Derived here rather than computed in the component
// so the panel never has to know the tree shape.
export const visibleTree = derived(
  [fileTree, expandedFolders],
  ([$fileTree, $expandedFolders]) =>
    flattenTree($fileTree, $expandedFolders) as ExplorerNode[],
);

// --- Tree actions: context menu and delete confirmation ----------------------

// The menu is opened by a tree row (or the empty space under it) and rendered
// once at the region root, so that a `position: fixed` card is not clipped by
// the scrolling list. Two components, one piece of state — so the verbs that
// move it live here, next to the tree they act on. `FileMenuState.node` is
// `null` when the menu was opened on the panel background, meaning "at the
// project root".

export function openFileMenu(state: FileMenuState) {
  fileMenu.set(state);
}

export function closeFileMenu() {
  fileMenu.set(null);
}

// Deleting is the one destructive action in the panel, so it goes through a
// confirmation the user has to answer. Same reasoning as the menu: the row asks,
// the dialog answers.

export function requestDeletion(node: ExplorerNode) {
  if (!get(canWrite)) return;
  pendingDeletion.set({
    id: node.id,
    name: node.name,
    kind: node.kind,
    isFolder: node.is_folder,
  });
}

export function cancelDeletion() {
  pendingDeletion.set(null);
}

export async function confirmDeletion() {
  const pending = get(pendingDeletion);
  if (!pending) return;
  pendingDeletion.set(null);
  if (pending.kind === "asset") {
    await deleteAsset(pending.id);
  } else {
    await deleteFile(pending.id);
  }
}

// Where a node created "next to" `nodeId` lands: inside it when it is a folder,
// beside it when it is a file, at the root when there is no anchor. Assets are
// looked up too — the explorer shows them in the same tree, so an id coming from
// a row is not necessarily a `File`.

export function anchorFolder(nodeId: string | null): File | null {
  if (!nodeId) return null;
  const $files = get(files);
  const node: File | Asset | undefined =
    $files.find((f) => f.id === nodeId) ??
    get(assets).find((a) => a.id === nodeId);
  if (!node) return null;
  if ("is_folder" in node && node.is_folder) return node;
  if (!node.parent_id) return null;
  return $files.find((f) => f.id === node.parent_id) ?? null;
}

export function newFileNextTo(nodeId: string | null) {
  const folder = anchorFolder(nodeId);
  if (folder) expandFolders([folder.id]);
  return newFile(folder ? `${folder.path}/newFile.typ` : "newFile.typ");
}

export function newFolderNextTo(nodeId: string | null) {
  const folder = anchorFolder(nodeId);
  if (folder) expandFolders([folder.id]);
  return newFolder(folder ? `${folder.path}/newFolder` : "newFolder");
}

// --- Dragging a node onto a folder -------------------------------------------

// Which row is being dragged has to be readable by every *other* row: `dragover`
// only exposes the data transfer's types, never its data, so a row cannot ask
// the event what is being dropped on it. One drag is in flight at a time, so it
// is one store — same reasoning as the context menu above.

export function startNodeDrag(nodeId: string) {
  if (!get(canWrite)) return;
  draggedNodeId.set(nodeId);
}

export function endNodeDrag() {
  draggedNodeId.set(null);
}

// Walking up from `candidateId`: a folder cannot be dropped inside its own
// subtree, which would detach that whole branch from the root.
function isInSubtreeOf(candidateId: string, ancestorId: string): boolean {
  const $files = get(files);
  let current = $files.find((f) => f.id === candidateId);
  while (current?.parent_id) {
    if (current.parent_id === ancestorId) return true;
    const parentId: string = current.parent_id;
    current = $files.find((f) => f.id === parentId);
  }
  return false;
}

// `targetNodeId` is a row the pointer is over, or `null` for the panel
// background. The destination folder follows the same anchor rule as creation:
// a folder takes the node, a file hands it to its own folder.
export function canDropOnNode(targetNodeId: string | null): boolean {
  const sourceId = get(draggedNodeId);
  if (!sourceId || !get(canWrite)) return false;
  if (sourceId === targetNodeId) return false;

  const source =
    get(files).find((f) => f.id === sourceId) ??
    get(assets).find((a) => a.id === sourceId);
  if (!source) return false;

  const destinationId = anchorFolder(targetNodeId)?.id ?? null;
  // Already where it would land — a move that changes nothing.
  if (source.parent_id === destinationId) return false;
  if (destinationId === sourceId) return false;
  if (destinationId && isInSubtreeOf(destinationId, sourceId)) return false;
  return true;
}

export async function dropOnNode(targetNodeId: string | null) {
  const sourceId = get(draggedNodeId);
  const allowed = canDropOnNode(targetNodeId);
  endNodeDrag();
  if (!sourceId || !allowed) return;

  const destinationId = anchorFolder(targetNodeId)?.id ?? null;
  if (destinationId) expandFolders([destinationId]);

  if (get(assets).some((a) => a.id === sourceId)) {
    await moveAsset(sourceId, destinationId);
  } else {
    await moveFile(sourceId, destinationId);
  }
}

// --- Asset upload ------------------------------------------------------------

// The server decides what an upload becomes: anything it can read as text comes
// back as a `File` (a source it will let people edit), everything else as an
// `Asset`. It also renames on collision, which is why the created row — not the
// one we sent — is what goes into the stores. Binary assets are cached on the
// way in so the compiler and the viewer do not have to fetch back what this
// browser just uploaded.
