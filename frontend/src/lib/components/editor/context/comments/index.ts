import {
  setActiveCommentEffect,
  setHoveredCommentEffect,
  updateCommentsEffect,
} from "$lib/codemirror/comments";
import { commentsApi, usersApi } from "$lib/services/api";
import { notifications } from "$lib/stores/notifications";
import { type Comment, type CommentThreadDTO } from "$lib/types";
import { applyReplyUpdate } from "../project/realtime";
import { ytext } from "../editor/view";
import {
  activeCommentId,
  canComment,
  canManageProject,
  commentDraft,
  commentors,
  comments,
  hoveredCommentId,
  leftPanelTab,
  projectId,
  projectYjs,
  selectedAsset,
  selectedFile,
  showCommentButton,
  type Disposer,
  view,
  ydoc,
} from "../state";
import type { CommentDraft } from "../types";
import { get } from "svelte/store";
import * as Y from "yjs";

/**
 * Comment threads: mapping the server's DTOs onto the panel's model, the draft
 * a new comment is composed in, the CRUD calls, and the decorations that mark
 * commented ranges in the document.
 */

export function hoverComment(commentId: string | null) {
  hoveredCommentId.set(commentId);
}

export function mapThreadToComment(thread: CommentThreadDTO): Comment {
  return {
    id: thread.id,
    fileId: thread.file_id,
    content: thread.content,
    authorId: thread.author_id,
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
    resolved: thread.status === "resolved",
    replies: (thread.replies || [])
      .filter((reply) => reply.status !== "deleted")
      .map((reply) => ({
        id: reply.id,
        content: reply.content,
        authorId: reply.author_id,
        createdAt: reply.created_at,
      })),
    line: 1,
    anchorRelJson: thread.anchor_rel_json,
    headRelJson: thread.head_rel_json,
  };
}

export function commentorColor(userId: string) {
  const safeUserId = String(userId ?? "");
  const seed = safeUserId
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = (seed * 47) % 360;
  return `hsl(${hue} 55% 45%)`;
}

export function isCommentorGuest(userId: string) {
  const profile = get(commentors).find((c) => c.id === userId);
  if (!profile) return false;
  return profile.user_type === "guest";
}

export function commentorName(userId: string) {
  const profile = get(commentors).find((c) => c.id === userId);
  return profile?.display_name || `User ${userId}`;
}

export async function loadCommentsForSelectedFile() {
  const file = get(selectedFile);
  if (!file || file.is_folder || get(selectedAsset)) {
    comments.set([]);
    return;
  }

  try {
    const threads = await commentsApi.listFileThreads(get(projectId), file.id);
    if (get(selectedFile)?.id !== file.id) {
      return;
    }

    const newComments = threads
      .filter((thread) => thread.status !== "deleted")
      .map(mapThreadToComment)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    commentors.set([]);
    newComments.forEach(async (comment) => {
      const profile = await usersApi.getProfile(comment.authorId);
      commentors.update((currentCommentors) => {
        if (!currentCommentors.find((c) => c.id === profile.id)) {
          return [...currentCommentors, profile];
        }
        return currentCommentors;
      });
      comment.replies.forEach(async (reply) => {
        const replyProfile = await usersApi.getProfile(reply.authorId);
        commentors.update((currentCommentors) => {
          if (!currentCommentors.find((c) => c.id === replyProfile.id)) {
            return [...currentCommentors, replyProfile];
          }
          return currentCommentors;
        });
      });
    });

    comments.set(newComments);
  } catch (error: any) {
    console.error("Failed to load comments:", error);
    const message = error?.response?.data?.detail || "Failed to load comments";
    notifications.show(message, "error", 4000);
  }
}

export function applyThreadUpdate(thread: CommentThreadDTO) {
  if (thread.status === "deleted") {
    comments.update((editorComments) => editorComments.filter((comment) => comment.id !== thread.id));
    activeCommentId.update((activeCommentId) => {
      if (activeCommentId === thread.id) {
        return null;
      }
      return activeCommentId;
    });
    return;
  }

  if (get(selectedFile)?.id !== thread.file_id) {
    return;
  }

  const mapped = mapThreadToComment(thread);
  const index = get(comments).findIndex((comment) => comment.id === mapped.id);
  if (index === -1) {
    comments.update((editorComments) => [...editorComments, mapped].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    return;
  }

  comments.update((editorComments) => editorComments.map((comment) =>
    comment.id === mapped.id ? mapped : comment,
  ));
}

export function getSelection() {
  const viewValue = get(view);
  if (!viewValue) return null;
  const { from, to } = viewValue.state.selection.main;
  return {
    from,
    to,
    text: viewValue.state.doc.sliceString(from, to),
  };
}

export function addComment() {
  if (!get(canComment)) return;

  const selection = getSelection();
  if (!selection || selection.from === selection.to) {
    return;
  }

  leftPanelTab.set("comments");

  commentDraft.set({
    text: "",
    range: { from: selection.from, to: selection.to },
    selectedText: selection.text,
  });

  showCommentButton.set(false);
}

export function getCommentContextFromSelection(from: number, to: number) {
  if (!get(view)) {
    return {
      anchorRelJson: null,
      headRelJson: null,
    };
  }

  let anchorRelJson: string | null = null;
  let headRelJson: string | null = null;
  const ytextValue = get(ytext);
  if (ytextValue) {
    try {
      const anchor = Y.createRelativePositionFromTypeIndex(ytextValue, from);
      const head = Y.createRelativePositionFromTypeIndex(ytextValue, to);
      anchorRelJson = JSON.stringify(Y.relativePositionToJSON(anchor));
      headRelJson = JSON.stringify(Y.relativePositionToJSON(head));
    } catch (error) {
      console.warn("Failed to create relative anchor positions for comment:", error);
    }
  }

  return {
    anchorRelJson,
    headRelJson,
  };
}

export async function createComment(payload: {
  file_id: string;
  content: string;
  anchor_rel_json: string | null;
  head_rel_json: string | null;
}) {
  if (!get(canComment)) return;

  const thread = await commentsApi.createThread(get(projectId), {
    file_id: payload.file_id,
    content: payload.content,
    anchor_rel_json: payload.anchor_rel_json,
    head_rel_json: payload.head_rel_json,
  });

  applyThreadUpdate(thread);
  activeCommentId.set(thread.id);
}

export async function submitNewComment() {
  if (!get(canComment)) return;

  const commentDraftValue = get(commentDraft);
  const selectedFileValue = get(selectedFile);
  if (!commentDraftValue || !selectedFileValue) return;

  const context = getCommentContextFromSelection(
    commentDraftValue.range.from,
    commentDraftValue.range.to,
  );

  try {
    await createComment({
      file_id: selectedFileValue.id,
      content: commentDraftValue.text,
      anchor_rel_json: context.anchorRelJson,
      head_rel_json: context.headRelJson,
    });
  } catch (error) {
    console.error("Failed to create comment:", error);
    return;
  }

  commentDraft.set(null);
}

export function cancelNewComment() {
  commentDraft.set(null);
}

export function selectComment(comment: Comment) {
  activeCommentId.set(comment.id);
  scrollToComment(comment);
  leftPanelTab.set("comments");
}

export function resolveRangeFromComment(comment: Comment): { from: number; to: number } | null {
  const doc = get(projectYjs)?.ydoc;
  if (!doc) return null;
  // Preferred path: resolve persisted Yjs relative anchors against current text.
  if (comment.anchorRelJson && comment.headRelJson) {
    try {
      const anchor = Y.createRelativePositionFromJSON(JSON.parse(comment.anchorRelJson));
      const head = Y.createRelativePositionFromJSON(JSON.parse(comment.headRelJson));
      const anchorPos = Y.createAbsolutePositionFromRelativePosition(anchor, doc);
      const headPos = Y.createAbsolutePositionFromRelativePosition(head, doc);
      if (anchorPos && headPos) {
        return {
          from: Math.min(anchorPos.index, headPos.index),
          to: Math.max(anchorPos.index, headPos.index),
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function scrollToComment(comment: Comment) {
  if (!comment) return;

  const range = resolveRangeFromComment(comment);
  if (range) {
    get(view)?.dispatch({
      selection: { anchor: range.from, head: range.to },
      scrollIntoView: true,
    });
  }
}

export function formatCommentDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export async function resolveComment(commentId: string) {
  if (!get(canComment)) return;

  const thread = await commentsApi.updateThread(get(projectId), commentId, {
    status: "resolved",
  });
  applyThreadUpdate(thread);
}

export async function reopenComment(commentId: string) {
  if (!get(canComment)) return;

  const thread = await commentsApi.updateThread(get(projectId), commentId, {
    status: "open",
  });
  applyThreadUpdate(thread);
}

export async function deleteComment(commentId: string) {
  if (!get(canManageProject)) return;

  const thread = await commentsApi.updateThread(get(projectId), commentId, {
    status: "deleted",
  });
  applyThreadUpdate(thread);
}

export async function replyComment(commentId: string, content: string) {
  if (!get(canComment)) return;

  const reply = await commentsApi.createReply(get(projectId), commentId, {
    content,
  });
  applyReplyUpdate(commentId, reply);
}

// --- Comment decorations -----------------------------------------------------
//
// Ranges come from the threads' own Yjs relative anchors, resolved against the
// live document, so they follow other people's edits without bookkeeping.

export function syncCommentDecorations() {
  const viewValue = get(view);
  if (!viewValue) return;

  const docLength = viewValue.state.doc.length;
  const ranges = new Map<string, { from: number; to: number }>();

  for (const comment of get(comments)) {
    if (comment.resolved) continue;
    const range = resolveRangeFromComment(comment);
    if (!range) continue;
    const from = Math.min(range.from, docLength);
    const to = Math.min(range.to, docLength);
    // A mark decoration may not be empty, and a thread whose anchored text has
    // been deleted resolves to exactly that.
    if (to <= from) continue;
    ranges.set(comment.id, { from, to });
  }

  viewValue.dispatch({
    effects: [
      updateCommentsEffect.of({ comments: ranges }),
      setActiveCommentEffect.of(get(activeCommentId)),
      setHoveredCommentEffect.of(get(hoveredCommentId)),
    ],
  });
}

/** Keep the document's comment decorations in step with the panel. */
export function wireComments(): Disposer {
  const disposers = [
    hoveredCommentId.subscribe((commentId) => {
      get(view)?.dispatch({ effects: setHoveredCommentEffect.of(commentId) });
    }),
    view.subscribe(() => {
      syncCommentDecorations();
    }),
    comments.subscribe(() => {
      syncCommentDecorations();
    }),
    activeCommentId.subscribe((commentId) => {
      get(view)?.dispatch({ effects: setActiveCommentEffect.of(commentId) });
    }),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}
