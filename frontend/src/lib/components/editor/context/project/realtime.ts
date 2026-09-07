import { createCommentSync } from "$lib/commentSync";
import { createProjectSync } from "$lib/projectSync";
import { auth } from "$lib/stores/auth";
import { type Asset, type CommentReplyDTO, type Project } from "$lib/types";
import { removeCachedAsset } from "$lib/utils/assetCache";
import { createProjectYjs, type YjsConnection } from "$lib/yjs";
import { handlePermissionSignal } from ".";
import { applyThreadUpdate, loadCommentsForSelectedFile } from "../comments";
import { ytext } from "../editor/view";
import {
  assets,
  awarenessStates,
  commentSync,
  comments,
  files,
  project,
  projectId,
  projectSync,
  projectYjs,
  selectedAsset,
  selectedFile,
  type Disposer,
  ydoc,
} from "../state";
import type { File } from "../types";
import { get } from "svelte/store";
/**
 * The live connections behind a project: the Yjs document and its provider, and
 * the two WebSockets that push file / asset / project rows and comment threads.
 *
 * The handlers below see the server's echo of every mutation, this client's own
 * included, which is why the CRUD in `../files` never writes to the stores.
 */

let stopAwarenessListener: (() => void) | null = null;

/** Mirror the Yjs awareness protocol into a store the UI can render. */
export function wireAwareness(): Disposer {
  const dispose = projectYjs.subscribe((yjsConnection) => {
    stopAwarenessListener?.();
    stopAwarenessListener = null;

    const awareness = yjsConnection?.provider.awareness;
    if (!awareness) {
      awarenessStates.set([]);
      return;
    }

    const updateAwarenessStates = () => {
      awarenessStates.set(Array.from(awareness.getStates().entries()));
    };
    awareness.on("change", updateAwarenessStates);
    updateAwarenessStates();
    stopAwarenessListener = () => awareness.off("change", updateAwarenessStates);
  });
  return () => {
    dispose();
    stopAwarenessListener?.();
    stopAwarenessListener = null;
  };
}

export function onFileCreated(file: File) {
  files.update((currentFiles) => {
    if (!currentFiles.find((f) => f.id === file.id)) {
      return [...currentFiles, file];
    }
    return currentFiles;
  });
}

function onFileUpdated(file: File) {
  files.update((currentFiles) => {
    return currentFiles.map((f) => (f.id === file.id ? file : f));
  });
  if (get(selectedFile)?.id === file.id) {
    selectedFile.set(file);
  }
}

function onFileDeleted(fileId: string) {
  files.update((currentFiles) => {
    const updatedFiles = currentFiles.filter((f) => f.id !== fileId);
    if (get(selectedFile)?.id === fileId) {
      selectedFile.set(updatedFiles[0] || null);
    }
    return updatedFiles;
  });

  if (get(projectYjs)?.ydoc) {
    const ytext = get(projectYjs)?.ydoc.getText(`file-${fileId}`);
    if (ytext && ytext.length > 0) {
      ytext.delete(0, ytext.length);
    }
  }
}

export function onAssetCreated(asset: Asset) {
  assets.update((currentAssets) => {
    if (!currentAssets.find((a) => a.id === asset.id)) {
      return [...currentAssets, asset];
    }
    return currentAssets;
  });
}

function onAssetUpdated(asset: Asset) {
  assets.update((currentAssets) => {
    return currentAssets.map((a) => (a.id === asset.id ? asset : a));
  });
  if (get(selectedAsset)?.id === asset.id) {
    selectedAsset.set(asset);
  }
}

function onAssetDeleted(assetId: string) {
  removeCachedAsset(get(projectId), assetId).catch((err) =>
    console.warn("Failed to remove deleted asset from cache:", err),
  );
  assets.update((currentAssets) => currentAssets.filter((a) => a.id !== assetId));
  if (get(selectedAsset)?.id === assetId) {
    }
}

function onProjectUpdated(updatedProject: Project) {
  project.update((currentProject) => {
    if (currentProject && updatedProject.id === currentProject.id) {
      return { ...currentProject, ...updatedProject };
    }
    return currentProject;
  });
}

function destroyYjsConnection(connection: YjsConnection) {
  connection.provider.destroy()
  connection.indexeddb.destroy()
  connection.ydoc.destroy()
}

export function applyReplyUpdate(threadId: string, reply: CommentReplyDTO) {
  if (reply.status === "deleted") {
    return;
  }

  comments.update((editorComments) => {
    editorComments = editorComments.map((comment) => {
      if (comment.id !== threadId) {
        return comment;
      }

      const nextReplies = comment.replies.some((item) => item.id === reply.id)
        ? comment.replies.map((item) =>
          item.id === reply.id
            ? {
              id: reply.id,
              content: reply.content,
              authorId: reply.author_id,
              createdAt: reply.created_at,
            }
            : item,
        )
        : [
          ...comment.replies,
          {
            id: reply.id,
            content: reply.content,
            authorId: reply.author_id,
            createdAt: reply.created_at,
          },
        ];

      return {
        ...comment,
        replies: nextReplies,
        updatedAt: reply.updated_at,
      };
    });
    return editorComments;
  });
}

export function destroyRealtimeConnections() {
  projectYjs.update((yjsConnection) => {
    if (yjsConnection) {
      destroyYjsConnection(yjsConnection);
      yjsConnection = null;
    }
    return yjsConnection;
  });
  projectSync.update((projectSync) => {
    if (projectSync) {
      projectSync.destroy();
      projectSync = null;
    }
    return projectSync;
  });
  commentSync.update((commentSync) => {
    if (commentSync) {
      commentSync.destroy();
      commentSync = null;
    }
    return commentSync;
  });
}

export function initRealtimeConnections() {
  projectYjs.set(createProjectYjs(
    get(projectId),
    get(auth).user,
    get(auth).token,
  ));

  projectSync.set(createProjectSync(get(projectId), {
    onFileCreated,
    onFileUpdated,
    onFileDeleted,
    onAssetCreated,
    onAssetUpdated,
    onAssetDeleted,
    onProjectUpdated,
    onUnauthorized: (event) => {
      void handlePermissionSignal(
        event.reason || "You no longer have permission for this realtime action",
      );
    },
  }, get(auth).token));

  commentSync.set(createCommentSync(
    get(projectId),
    {
      onConnected: ({ reconnected }) => {
        if (reconnected) {
          void loadCommentsForSelectedFile();
        }
      },
      onThreadCreated: (message) => {
        if (message.thread) {
          applyThreadUpdate(message.thread);
        }
      },
      onThreadUpdated: (message) => {
        if (message.thread) {
          applyThreadUpdate(message.thread);
        }
      },
      onReplyCreated: (message) => {
        if (message.reply && message.thread_id) {
          applyReplyUpdate(message.thread_id, message.reply);
        }
      },
      onPermissionChanged: (message) => {
        void handlePermissionSignal({
          reason: message.reason || "Your project permissions have changed",
          action: message.action,
          newRole: message.new_role,
        });
      },
      onUnauthorized: (event) => {
        void handlePermissionSignal(
          event.reason ||
          "You no longer have permission for realtime comment updates",
        );
      },
    },
    get(auth).token,
  ));
}
