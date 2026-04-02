<script lang="ts">
  import { browser } from "$app/environment";
  import type { Comment } from "$lib/types";
  import type { UserProfile } from "$lib/types";
  import { usersApi } from "$lib/services/api";
  import CommentThread from "./CommentThread.svelte";

  interface CommentsPanelProps {
    comments?: Comment[];
    currentUserId: string;
    canComment?: boolean;
    canDeleteComments?: boolean;
    newCommentDraft?: {
      text: string;
      range: { from: number; to: number };
      selectedText: string;
    } | null;
    activeCommentId?: string | null;
    hoveredCommentId?: string | null;
    commentPositions?: Map<string, number>;
    editorScrollTop?: number;
    editorContentHeight?: number;
    draftPosition?: number | null;
    onResolve?: (commentId: string) => void;
    onReopen?: (commentId: string) => void;
    onDelete?: (commentId: string) => void;
    onReply?: (commentId: string, content: string) => void;
    onSubmitNew?: (content: string) => void;
    onCancelNew?: () => void;
    onSelect?: (commentId: string) => void;
    onHover?: (commentId: string) => void;
    onHoverEnd?: (commentId: string) => void;
    onPanelScroll?: (scrollTop: number) => void;
  }

  let {
    comments = [],
    currentUserId,
    canComment = true,
    canDeleteComments = false,
    newCommentDraft = null,
    activeCommentId = null,
    hoveredCommentId = null,
    commentPositions = new Map(),
    editorScrollTop = 0,
    editorContentHeight = 2000,
    draftPosition = null,
    onResolve,
    onReopen,
    onDelete,
    onReply,
    onSubmitNew,
    onCancelNew,
    onSelect,
    onHover,
    onHoverEnd,
    onPanelScroll,
  }: CommentsPanelProps = $props();

  let showResolved = $state(
    browser && localStorage.getItem("editor.comments.showResolved") !== null
      ? localStorage.getItem("editor.comments.showResolved") === "true"
      : false,
  );
  let draftCommentText = $state("");
  let userProfiles = $state<Record<string, UserProfile>>({});
  let requestedUserIds = $state<Set<string>>(new Set());
  let panelScrollEl: HTMLElement | undefined = $state();
  let threadHeights = $state<Map<string, number>>(new Map());
  let isSyncingScroll = false;

  let visibleComments = $derived(
    comments.filter((c) => showResolved || !c.resolved),
  );
  let resolvedCount = $derived(comments.filter((c) => c.resolved).length);
  let isEmptyStateVisible = $derived(
    visibleComments.length === 0 && !newCommentDraft,
  );

  $effect(() => {
    if (browser) {
      localStorage.setItem(
        "editor.comments.showResolved",
        String(showResolved),
      );
    }
  });

  $effect(() => {
    const userIds = new Set<string>();
    for (const comment of comments) {
      userIds.add(comment.authorId);
      for (const reply of comment.replies) {
        userIds.add(reply.authorId);
      }
    }

    const toFetch = [...userIds].filter(
      (id) => !!id && !userProfiles[id] && !requestedUserIds.has(id),
    );
    if (!toFetch.length) return;

    requestedUserIds = new Set([...requestedUserIds, ...toFetch]);

    Promise.all(
      toFetch.map(async (id) => {
        try {
          const profile = await usersApi.getProfile(id);
          return { id, profile };
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      const nextProfiles = { ...userProfiles };
      for (const item of results) {
        if (item?.profile) {
          nextProfiles[item.id] = item.profile;
        }
      }
      userProfiles = nextProfiles;
    });
  });

  // Focus and clear when draft changes
  $effect(() => {
    if (newCommentDraft && canComment) {
      draftCommentText = "";
      setTimeout(() => {
        const textarea = document.querySelector(
          ".new-comment-textarea",
        ) as HTMLTextAreaElement;
        if (textarea) textarea.focus();
      }, 0);
    }
  });

  // Sync panel scroll from editor scroll (one-way: editor → panel)
  $effect(() => {
    if (panelScrollEl && editorScrollTop != null) {
      if (isEmptyStateVisible) {
        panelScrollEl.scrollTop = 0;
        return;
      }

      // Guard to avoid loop when we're already syncing from panel → editor
      isSyncingScroll = true;
      panelScrollEl.scrollTop = editorScrollTop;
      requestAnimationFrame(() => {
        isSyncingScroll = false;
      });
    }
  });

  function handlePanelScroll(e: Event) {
    if (isSyncingScroll) return;
    const target = e.target as HTMLElement;
    onPanelScroll?.(target.scrollTop);
  }

  // Compute positioned comments with overlap resolution.
  // If no editor-mapped position exists yet, fall back to line-based placement
  // so DB-backed comments still render after reload/reconnect.
  let positionedComments = $derived.by(() => {
    const MIN_GAP = 4;
    const LINE_HEIGHT_FALLBACK = 20;

    type PositionedItem = {
      type: "draft" | "comment";
      comment?: Comment;
      id: string;
      idealTop: number;
      actualTop: number;
      height: number;
    };

    const items: PositionedItem[] = [];

    // Add draft if present
    if (canComment && newCommentDraft && draftPosition != null) {
      items.push({
        type: "draft",
        id: "__draft__",
        idealTop: draftPosition,
        actualTop: draftPosition,
        height: threadHeights.get("__draft__") || 120,
      });
    }

    const sortedComments = [...visibleComments].sort((a, b) => {
      if (a.line !== b.line) return a.line - b.line;
      return a.createdAt.localeCompare(b.createdAt);
    });

    // Add all visible comments. Use editor-mapped position when available,
    // otherwise place comment near its persisted line as a fallback.
    for (const comment of sortedComments) {
      const mappedPos = commentPositions.get(comment.id);
      const fallbackPos = Math.max(
        0,
        (Math.max(1, comment.line) - 1) * LINE_HEIGHT_FALLBACK,
      );
      const idealTop = mappedPos ?? fallbackPos;

      items.push({
        type: "comment",
        comment,
        id: comment.id,
        idealTop,
        actualTop: idealTop,
        height: threadHeights.get(comment.id) || 80,
      });
    }

    // Sort by ideal position
    items.sort((a, b) => a.idealTop - b.idealTop);

    // Find the active item index (selected comment gets priority)
    const activeIdx = items.findIndex((item) => item.id === activeCommentId);

    if (activeIdx >= 0) {
      // Active comment stays at its ideal position
      items[activeIdx].actualTop = items[activeIdx].idealTop;

      // Push items BELOW the active one downward
      for (let i = activeIdx + 1; i < items.length; i++) {
        const prev = items[i - 1];
        const minTop = prev.actualTop + prev.height + MIN_GAP;
        if (items[i].actualTop < minTop) {
          items[i].actualTop = minTop;
        }
      }

      // Push items ABOVE the active one upward
      for (let i = activeIdx - 1; i >= 0; i--) {
        const next = items[i + 1];
        const maxBottom = next.actualTop - MIN_GAP;
        if (items[i].actualTop + items[i].height > maxBottom) {
          items[i].actualTop = maxBottom - items[i].height;
        }
      }
    } else {
      // No active comment — simple top-down push
      for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1];
        const minTop = prev.actualTop + prev.height + MIN_GAP;
        if (items[i].actualTop < minTop) {
          items[i].actualTop = minTop;
        }
      }
    }

    return items;
  });

  function handleSubmitNewComment() {
    if (draftCommentText.trim()) {
      onSubmitNew?.(draftCommentText.trim());
      draftCommentText = "";
    }
  }

  function handleCancelNewComment() {
    draftCommentText = "";
    onCancelNew?.();
  }

  function measureThread(el: HTMLElement, id: string) {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h =
          entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        threadHeights.set(id, h);
        threadHeights = new Map(threadHeights);
      }
    });
    observer.observe(el);
    return {
      destroy() {
        observer.disconnect();
      },
    };
  }

  function handleShowResolvedChange() {
    const filterLabel = document.querySelector(".filter-label") as HTMLElement;
    if (filterLabel) {
      const text = showResolved
        ? `Hide resolved (${resolvedCount})`
        : `Show resolved (${resolvedCount})`;
      filterLabel.textContent = text;
    }
  }
</script>

<div class="comments-panel">
  {#if resolvedCount > 0}
    <div class="filter-section">
      <label class="filter-toggle">
        <input
          class="filter-checkbox"
          type="checkbox"
          bind:checked={showResolved}
          onchange={handleShowResolvedChange}
        />
        <span class="filter-label">Show resolved ({resolvedCount})</span>
      </label>
    </div>
  {/if}

  <div
    class="panel-scroll"
    bind:this={panelScrollEl}
    onscroll={handlePanelScroll}
  >
    <div
      class="panel-content"
      style={isEmptyStateVisible
        ? undefined
        : `height: ${editorContentHeight}px;`}
    >
      {#each positionedComments as item (item.id)}
        {#if item.type === "draft"}
          <div
            class="positioned-thread"
            style="top: {item.actualTop}px;"
            use:measureThread={"__draft__"}
          >
            <div class="new-comment-draft">
              <textarea
                class="new-comment-textarea"
                bind:value={draftCommentText}
                placeholder="Add your comment..."
                rows="2"
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitNewComment();
                  }
                  if (e.key === "Escape") {
                    handleCancelNewComment();
                  }
                }}
              ></textarea>
              <div class="draft-actions">
                <button class="btn btn-cancel" onclick={handleCancelNewComment}
                  >Cancel</button
                >
                <button
                  class="btn btn-submit"
                  onclick={handleSubmitNewComment}
                  disabled={!draftCommentText.trim()}
                >
                  Comment
                </button>
              </div>
            </div>
          </div>
        {:else if item.comment}
          <div
            class="positioned-thread"
            style="top: {item.actualTop}px;"
            use:measureThread={item.id}
          >
            <CommentThread
              comment={item.comment}
              {userProfiles}
              {currentUserId}
              {canComment}
              {canDeleteComments}
              isActive={item.id === activeCommentId}
              isHovered={item.id === hoveredCommentId}
              {onResolve}
              {onReopen}
              {onDelete}
              {onReply}
              {onSelect}
              {onHover}
              {onHoverEnd}
            />
          </div>
        {/if}
      {/each}

      {#if visibleComments.length === 0 && !(canComment && newCommentDraft)}
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <p>No comments yet</p>
          <span
            >{canComment
              ? "Select text to add a comment"
              : "You have read-only access to comments"}</span
          >
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .comments-panel {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .filter-section {
    padding: 8px 8px 4px;
    flex-shrink: 0;
  }

  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 12px;
    user-select: none;
  }

  .filter-checkbox {
    display: none;
  }

  .filter-label {
    position: relative;
    color: var(--text-tertiary);
  }

  .filter-label:hover {
    color: var(--text-secondary);
  }

  .filter-label:active {
    color: var(--text-primary);
    transform: translateY(1px);
  }

  .panel-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .panel-scroll::-webkit-scrollbar {
    display: none;
  }

  .panel-content {
    position: relative;
    min-height: 100%;
  }

  .positioned-thread {
    position: absolute;
    left: 0px;
    right: 0px;
    transition: top 0.2s ease-out;
  }

  .empty-state {
    position: absolute;
    top: 48%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: none;
    text-align: center;
    width: 90%;
  }

  .empty-icon {
    font-size: 52px;
    margin-bottom: 6px;
    opacity: 0.3;
    transform: translateX(35px);
    user-select: none;
    pointer-events: none;
    -webkit-user-drag: none;
  }

  .empty-state p {
    font-size: 30px;
    font-family: "DM Serif Display", Georgia, serif;
    letter-spacing: -0.015em;
    line-height: 1em;
    color: var(--text-secondary);
    margin: 0 0 12px 0;
    font-weight: 900;
  }

  .empty-state span {
    font-size: 15px;
    color: var(--text-tertiary);
  }

  .new-comment-draft {
    background: var(--surface-primary);
    border: 1px solid var(--color-primary-600);
    border-radius: 10px;
    padding: 10px;
  }

  .new-comment-textarea {
    width: 100%;
    background: var(--surface-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 8px;
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
    resize: none;
    margin-bottom: 8px;
  }

  .new-comment-textarea:focus {
    outline: none;
    border-color: var(--color-primary-600);
  }

  .draft-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .btn {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
  }

  .btn-cancel {
    background: var(--surface-secondary);
    color: var(--text-primary);
  }

  .btn-cancel:hover {
    background: var(--surface-hover);
  }

  .btn-submit {
    background: var(--color-primary-600);
    color: white;
  }

  .btn-submit:hover:not(:disabled) {
    background: var(--color-primary-700);
  }

  .btn-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
