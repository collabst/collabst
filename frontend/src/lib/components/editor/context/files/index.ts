import { assetsApi, filesApi } from "$lib/services/api";
import { notifications } from "$lib/stores/notifications";
import { getAncestorIds } from "$lib/utils/fileTree";
import { loadCommentsForSelectedFile } from "../comments";
import { errorDetail } from "../lifecycle";
import { onFileCreated } from "../project/realtime";
import { syncFilesAndAssets } from "../preview/worker";
import {
  assets,
  canWrite,
  files,
  mainFile,
  projectId,
  renamingNodeId,
  selectedAsset,
  selectedFile,
  type Disposer,
} from "../state";
import type { File } from "../types";
import { wireAssetViewer } from "./assets";
import { wireFileObservers } from "./observers";
import { expandFolders } from "./tree";
import { get } from "svelte/store";

/**
 * Which file is open, which one the compiler builds, and the REST calls that
 * create, rename, move and delete files and assets.
 *
 * The explorer's own UI state lives in `./tree`, assets in `./assets`, and the
 * Yjs text observers in `./observers`.
 */

const MAIN_FILE_STORAGE_PREFIX = "collabst:main-file:";

function readStoredMainFileId(projectIdValue: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(`${MAIN_FILE_STORAGE_PREFIX}${projectIdValue}`);
  } catch {
    return null;
  }
}

function writeStoredMainFileId(projectIdValue: string, fileId: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`${MAIN_FILE_STORAGE_PREFIX}${projectIdValue}`, fileId);
  } catch {
    // Storage can be unavailable (private mode, quota); the choice is then
    // simply not remembered across reloads.
  }
}

function resolveMainFile(): File | null {
  const candidates = get(files).filter((f) => !f.is_folder);

  const rememberedId = readStoredMainFileId(get(projectId));
  const remembered = rememberedId
    ? candidates.find((f) => f.id === rememberedId)
    : undefined;
  if (remembered) return remembered;

  return (
    candidates.find((f) => f.path === "/main.typ") ??
    candidates.find((f) => f.name.toLowerCase().endsWith(".typ")) ??
    null
  );
}

export function setMainFile(fileId: string) {
  const file = get(files).find((f) => f.id === fileId);
  if (!file || file.is_folder) return;

  mainFile.set(file);
  writeStoredMainFileId(get(projectId), file.id);
  syncFilesAndAssets();
}

export async function initSelectedFile() {
  const allFiles = get(files);

  const entryFile = resolveMainFile();
  mainFile.set(entryFile);

  if (entryFile) {
    selectFile(entryFile.id);
    return;
  }

  if (allFiles.length > 0) {
    selectFile(allFiles[0].id);
  }
}


export function selectFile(fileId: string) {
  const file = get(files).find((f) => f.id === fileId);
  if (file) {
    selectedFile.set(file);
    // Opening a document closes the asset view; the two share the editor panel.
    selectedAsset.set(null);
    // A file selected from anywhere but the tree — the entry point at init, a
    // search hit, a diagnostic — has to become visible in it.
    expandFolders(getAncestorIds(get(files), fileId));
  }
  void loadCommentsForSelectedFile();
}

// Resolve the directory part of `path` to the id of an existing folder.
// `null` means the project root; `undefined` means the path names a folder that
// does not exist, so the caller must refuse rather than silently create at the
// root.
export function resolveParentId(path: string): string | null | undefined {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash <= 0) return null;

  const dir = path.slice(0, lastSlash);
  const folderPath = dir.startsWith("/") ? dir : `/${dir}`;
  const folder = get(files).find((f) => f.is_folder && f.path === folderPath);
  return folder ? folder.id : undefined;
}

// Inline rename is a two-component flow: the panel header creates a node and the
// tree row that appears for it has to open its editor, so "which node is being
// renamed" cannot be local state in either of them. It is deliberately *not*
// cleared when `files` changes: the rename target is created by `newFile()` a
// moment before the row exists.

export async function newFile(path: string) {
  if (!get(canWrite)) return;

  const $projectId = get(projectId);
  const name = path.split('/').pop();
  if (!name) {
    throw new Error("Invalid file path");
  }

  const parentId = resolveParentId(path);
  if (parentId === undefined) {
    notifications.show(`No such folder for ${path}`, "error", 5000);
    return;
  }

  try {
    const createdFile = await filesApi.create($projectId, name, "", parentId);
    onFileCreated(createdFile);
    selectedAsset.set(null);
    selectFile(createdFile.id);
    // The name the caller passed is a placeholder ("newFile.typ"): a freshly
    // created node opens straight into its inline editor so it can be named.
    renamingNodeId.set(createdFile.id);
    if (createdFile.name !== name) {
      notifications.show(`Name already used, created as ${createdFile.name}`, "info");
    }
    return createdFile;
  } catch (error) {
    console.error("Failed to create file:", error);
    notifications.show(errorDetail(error, "Failed to create file"), "error", 5000);
    throw error;
  }
}

export async function newFolder(path: string) {
  if (!get(canWrite)) return;

  const $projectId = get(projectId);
  const name = path.split('/').pop();
  if (!name) {
    throw new Error("Invalid folder path");
  }

  const parentId = resolveParentId(path);
  if (parentId === undefined) {
    notifications.show(`No such folder for ${path}`, "error", 5000);
    return;
  }

  try {
    // Deliberately not selected: selecting a folder would steal focus from the
    // editor for something that has no content to show.
    const createdFolder = await filesApi.createFolder($projectId, name, parentId);
    onFileCreated(createdFolder);
    renamingNodeId.set(createdFolder.id);
    if (createdFolder.name !== name) {
      notifications.show(`Name already used, created as ${createdFolder.name}`, "info");
    }
    return createdFolder;
  } catch (error) {
    console.error("Failed to create folder:", error);
    notifications.show(errorDetail(error, "Failed to create folder"), "error", 5000);
    throw error;
  }
}

export async function renameFile(fileId: string, newName: string) {
  if (!get(canWrite)) return;

  try {
    await filesApi.update(get(projectId), fileId, { name: newName });
  } catch (error) {
    console.error("Failed to rename file:", error);
    notifications.show(errorDetail(error, "Failed to rename file"), "error", 5000);
    throw error;
  }
}

export async function moveFile(fileId: string, targetFolderId: string | null) {
  if (!get(canWrite)) return;

  const fileToMove = get(files).find((f) => f.id === fileId);
  if (!fileToMove || fileToMove.parent_id === targetFolderId) return;

  try {
    await filesApi.move(get(projectId), fileId, targetFolderId);
  } catch (error) {
    console.error("Failed to move file:", error);
    notifications.show(errorDetail(error, "Failed to move file"), "error", 5000);
    throw error;
  }
}

export async function deleteFile(fileId: string) {
  if (!get(canWrite)) return;

  try {
    await filesApi.delete(get(projectId), fileId);
  } catch (error) {
    console.error("Failed to delete file:", error);
    notifications.show(errorDetail(error, "Failed to delete file"), "error", 5000);
    throw error;
  }
}

export async function renameAsset(assetId: string, newName: string) {
  if (!get(canWrite)) return;

  try {
    await assetsApi.update(get(projectId), assetId, { filename: newName });
  } catch (error) {
    console.error("Failed to rename asset:", error);
    notifications.show(errorDetail(error, "Failed to rename asset"), "error", 5000);
    throw error;
  }
}

export async function moveAsset(assetId: string, targetFolderId: string | null) {
  if (!get(canWrite)) return;

  const assetToMove = get(assets).find((a) => a.id === assetId);
  if (!assetToMove || assetToMove.parent_id === targetFolderId) return;

  try {
    await assetsApi.move(get(projectId), assetId, targetFolderId);
  } catch (error) {
    console.error("Failed to move asset:", error);
    notifications.show(errorDetail(error, "Failed to move asset"), "error", 5000);
    throw error;
  }
}

export async function deleteAsset(assetId: string) {
  if (!get(canWrite)) return;

  try {
    await assetsApi.delete(get(projectId), assetId);
  } catch (error) {
    console.error("Failed to delete asset:", error);
    notifications.show(errorDetail(error, "Failed to delete asset"), "error", 5000);
    throw error;
  }
}


// --- The explorer tree -------------------------------------------------------

// Files and assets are two tables but one tree on screen: they share the folder
// rows (an asset's `parent_id` points at a `File` folder), so they have to be
// merged before the tree is built, not after. `kind` is what the list item needs
// to know whether clicking it opens a document or an image; everything else is
// the `File` shape `buildFileTree()` already understands.

/**
 * Keep `mainFile` pointing at a row that still exists.
 *
 * A module-scope subscription until now (`PHASE2.md` §2.2), so it also ran
 * during teardown, when `files.set([])` made it hunt for a replacement entry
 * point in a project that was going away.
 */
export function wireMainFile(): Disposer {
  // The entry point can move under us — a collaborator renames or deletes it, and
  // the projectSync WS pushes the new list. `mainFile` held the row it was given
  // at init, so `compile()` kept posting a path the worker no longer has until the
  // next reload. The stored id is left untouched on the delete path: falling back
  // to another file is a guess, not a choice the author made, so it should not
  // overwrite one they did make.
  return files.subscribe(($files) => {
    const current = get(mainFile);
    if (!current) return;

    const updated = $files.find((f) => f.id === current.id && !f.is_folder);
    if (updated) {
      if (updated === current) return;
      // Same row, new object: a rename or a move changed its path, and the
      // compiler has to be told which document to build.
      mainFile.set(updated);
      if (updated.path !== current.path) syncFilesAndAssets();
      return;
    }

    const replacement = resolveMainFile();
    mainFile.set(replacement);
    // No replacement means the project has no `.typ` file left (or is being torn
    // down); there is nothing to compile, and `compile()` keeps its own fallback.
    if (replacement) syncFilesAndAssets();
  });
}

/** Everything the file tree needs live while a project is open. */
export function wireFiles(): Disposer {
  const disposers = [wireMainFile(), wireAssetViewer(), wireFileObservers()];
  return () => {
    for (const dispose of disposers) dispose();
  };
}
