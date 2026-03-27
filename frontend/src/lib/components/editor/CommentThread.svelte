<script lang="ts">
  import type { Comment, UserProfile } from "$lib/types";
  import { getProfilePicUrl } from "$lib/utils/urls";
  import Feather from "@lucide/svelte/icons/feather"

  interface CommentThreadProps {
    comment: Comment;
    userProfiles: Record<string, UserProfile>;
    currentUserId: string;
    canComment?: boolean;
    canDeleteComments?: boolean;
    isActive?: boolean;
    isHovered?: boolean;
    onResolve?: (commentId: string) => void;
    onDelete?: (commentId: string) => void;
    onReply?: (commentId: string, content: string) => void;
    onSelect?: (commentId: string) => void;
    onHover?: (commentId: string) => void;
    onHoverEnd?: (commentId: string) => void;
  }

  let {
    comment,
    userProfiles,
    currentUserId,
    canComment = true,
    canDeleteComments = false,
    isActive = false,
    onResolve,
    onDelete,
    onReply,
    onSelect,
    onHover,
    onHoverEnd,
    isHovered = false,
  }: CommentThreadProps = $props();

  let threadElement: HTMLElement | undefined = $state();

  // Auto-scroll into view when this thread becomes active
  $effect(() => {
    if (isActive && threadElement) {
      threadElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  let replyText = $state("");
  let replyFocused = $state(false);
  let replyTextarea: HTMLTextAreaElement | undefined = $state();
  let showMenu = $state(false);
  let loadedProfilePics = $state<Record<string, boolean>>({});

  function formatDate(dateStr: string) {
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

  function handleResolve() {
    onResolve?.(comment.id);
  }

  function handleDelete() {
    onDelete?.(comment.id);
  }

  function handleSubmitReply() {
    if (replyText.trim()) {
      onReply?.(comment.id, replyText.trim());
      replyText = "";
      replyFocused = false;
      replyTextarea?.blur();
    }
  }

  function handleCancelReply() {
    replyText = "";
    replyFocused = false;
    replyTextarea?.blur();
  }

  function toggleMenu(e: MouseEvent) {
    e.stopPropagation();
    showMenu = !showMenu;
  }

  function closeMenu() {
    showMenu = false;
  }

  function handleMenuAction(action: () => void) {
    return (e: MouseEvent) => {
      e.stopPropagation();
      action();
      closeMenu();
    };
  }

  function authorName(userId: string) {
    return userProfiles[userId]?.display_name || `User ${userId}`;
  }

  function isGuestAuthor(userId: string) {
    const profile = userProfiles[userId];
    if (!profile) return false;
    return profile.user_type === "guest"
  }

  function authorColor(userId: string) {
    const safeUserId = String(userId ?? "");
    const seed = safeUserId
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = (seed * 47) % 360;
    return `hsl(${hue} 55% 45%)`;
  }

  function profilePicSrc(userId: string) {
    return getProfilePicUrl(userId);
  }

  function handleAvatarLoad(userId: string) {
    loadedProfilePics = { ...loadedProfilePics, [userId]: true };
  }

  function hasLoadedAvatar(userId: string) {
    return !!loadedProfilePics[userId];
  }

  let canDeleteThisComment = $derived(
    canDeleteComments,
  );

  let canShowActionMenu = $derived(canComment || canDeleteThisComment);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="comment-thread"
  class:resolved={comment.resolved}
  class:active={isActive}
  class:hovered={isHovered}
  bind:this={threadElement}
  onclick={() => onSelect?.(comment.id)}
  onmouseenter={() => onHover?.(comment.id)}
  onmouseleave={() => onHoverEnd?.(comment.id)}
>
  <div class="comment-header">
    <div class="author-info">
      <div
        class="author-avatar"
        style="background-color: {authorColor(comment.authorId)}"
        title={authorName(comment.authorId)}
        onclick={(e) => e.stopPropagation()}
      >
        <span
          class="avatar-fallback"
          class:avatar-fallback-hidden={hasLoadedAvatar(comment.authorId)}
        >
          {authorName(comment.authorId).charAt(0).toUpperCase()}
        </span>
        <img
          class="avatar-image"
          class:avatar-image-loaded={hasLoadedAvatar(comment.authorId)}
          src={profilePicSrc(comment.authorId)}
          alt={`${authorName(comment.authorId)} avatar`}
          onload={() => handleAvatarLoad(comment.authorId)}
          onerror={() => {}}
        />
      </div>
      <div class="author-details">
        <span class="author-name">
          {authorName(comment.authorId)}
          {#if isGuestAuthor(comment.authorId)}
            <span
              class="guest-badge"
              title="Guest account: temporary access via shared link"
              aria-label="Guest account"
            >
              <Feather size={12} />
            </span>
          {/if}
        </span>
        <span class="comment-time">{formatDate(comment.createdAt)}</span>
      </div>
    </div>
    <div class="comment-actions">
      <div class="menu-container">
        {#if canShowActionMenu}
          <button
            class="action-btn menu-btn"
            onclick={toggleMenu}
            title="More actions"
          >
            ⋯
          </button>
        {/if}
        {#if canShowActionMenu && showMenu}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="menu-backdrop"
            onclick={handleMenuAction(closeMenu)}
          ></div>
          <div class="menu-dropdown">
            {#if !comment.resolved}
              <button
                class="menu-item"
                onclick={handleMenuAction(handleResolve)}
              >
                <span class="menu-icon">✓</span> Resolve
              </button>
            {/if}
            {#if canDeleteThisComment}
              <button class="menu-item menu-item-danger" onclick={handleMenuAction(handleDelete)}>
                <span class="menu-icon">✕</span> Delete
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="comment-content">
    {comment.content}
  </div>

  {#if comment.replies.length > 0}
    <div class="replies">
      {#each comment.replies as reply}
        <div class="reply">
          <div class="reply-header">
            <div
              class="reply-avatar"
              style="background-color: {authorColor(reply.authorId)}"
              title={authorName(reply.authorId)}
              onclick={(e) => e.stopPropagation()}
            >
              <span
                class="avatar-fallback"
                class:avatar-fallback-hidden={hasLoadedAvatar(reply.authorId)}
              >
                {authorName(reply.authorId).charAt(0).toUpperCase()}
              </span>
              <img
                class="avatar-image"
                class:avatar-image-loaded={hasLoadedAvatar(reply.authorId)}
                src={profilePicSrc(reply.authorId)}
                alt={`${authorName(reply.authorId)} avatar`}
                onload={() => handleAvatarLoad(reply.authorId)}
                onerror={() => {}}
              />
            </div>
            <span class="reply-author">{authorName(reply.authorId)}</span>
            {#if isGuestAuthor(reply.authorId)}
              <span
                class="guest-badge"
                title="Guest account: temporary access via shared link"
                aria-label="Guest account"
              >
                <Feather size={11} />
              </span>
            {/if}
            <span class="reply-time">{formatDate(reply.createdAt)}</span>
          </div>
          <div class="reply-content">{reply.content}</div>
        </div>
      {/each}
    </div>
  {/if}

  {#if canComment && !comment.resolved}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="reply-form"
      class:reply-form-active={replyFocused || replyText.trim()}
      onclick={(e: MouseEvent) => e.stopPropagation()}
    >
      <textarea
        bind:this={replyTextarea}
        bind:value={replyText}
        placeholder="Reply..."
        rows="1"
        onfocus={() => (replyFocused = true)}
        onblur={() => (replyFocused = false)}
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmitReply();
          }
          if (e.key === "Escape") {
            handleCancelReply();
          }
        }}
      ></textarea>
    </div>
  {/if}
</div>

<style>
  .comment-thread {
    background: var(--bg-editor);
    border: 1px solid var(--border-tertiary);
    border-radius: 10px;
    padding: 8px;
    margin-bottom: 6px;
    transition: opacity 1s;
  }

  .comment-thread.resolved {
    opacity: 0.7;
    background: var(--bg-primary);
  }

  .comment-thread:hover,
  .comment-thread.hovered {
    border: 1px solid
      color-mix(
        in srgb,
        var(--comment-highlight-active-border),
        transparent 10%
      );
  }

  .comment-thread.active {
    border: 1px solid var(--comment-highlight-active-border);
    background: color-mix(
      in srgb,
      var(--comment-highlight-active-bg),
      var(--bg-editor) 80%
    );
    box-shadow: 0 2px 0px var(--comment-highlight-active-border);
  }

  .comment-thread:active {
    transform: translateY(3px);
    box-shadow: 0 0 0 transparent;
  }

  .comment-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .author-info {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .author-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
    text-decoration: none;
    overflow: hidden;
    position: relative;
  }

  .author-avatar img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-fallback {
    position: relative;
    z-index: 1;
  }

  .avatar-fallback-hidden {
    opacity: 0;
  }

  .avatar-image {
    opacity: 0;
    position: absolute;
    inset: 0;
  }

  .avatar-image-loaded {
    opacity: 1;
  }

  .author-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .author-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .guest-badge {
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: help;
  }

  .guest-badge:hover {
    color: var(--text-primary);
  }

  .comment-time {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .comment-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .comment-thread:hover .comment-actions,
  .comment-thread.hovered .comment-actions,
  .comment-thread.active .comment-actions {
    opacity: 1;
  }

  .menu-container {
    position: relative;
  }

  .menu-btn {
    font-size: 8px;
    letter-spacing: 1px;
    line-height: 1;
  }

  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .menu-dropdown {
    position: absolute;
    right: 0;
    top: 100%;
    margin-top: 4px;
    background: var(--surface-primary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 4px;
    min-width: 120px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.1s;
  }

  .menu-item:hover {
    background: var(--surface-hover);
  }

  .menu-item-danger:hover {
    color: var(--color-error);
  }

  .menu-icon {
    font-size: 12px;
    width: 16px;
    text-align: center;
  }

  .action-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 2px 8px 6px 8px;
    border-radius: 99px;
    font-size: 18px;
    transition: none;
  }

  .action-btn:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .action-btn:active {
    transform: scaleX(1.1) scaleY(0.9);
  }

  .comment-content {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .replies {
    margin-top: 10px;
    padding-left: 8px;
    border-left: 2px solid var(--border-primary);
  }

  .reply {
    margin-bottom: 8px;
  }

  .reply-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .reply-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 10px;
    font-weight: 600;
    flex-shrink: 0;
    text-decoration: none;
    overflow: hidden;
    position: relative;
  }

  .reply-avatar img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .reply-author {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    text-decoration: none;
  }

  .reply-time {
    font-size: 10px;
    color: var(--text-secondary);
  }

  .reply-content {
    font-size: 12px;
    color: var(--text-primary);
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-word;
    padding-left: 3px;
  }

  .reply-form {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .reply-form textarea {
    width: 100%;
    background: var(--surface-hover);
    border: 1px solid transparent;
    border-radius: 50px;
    padding: 6px 12px;
    color: var(--text-primary);
    font-size: 12px;
    font-family: inherit;
    resize: none;
    overflow: hidden;
    transition:
      border-radius 0.15s,
      border-color 0.15s;
  }

  .comment-thread.active .reply-form textarea {
    background: var(--comment-highlight-active-input);
    border-color: color-mix(
      in srgb,
      var(--comment-highlight-active-border),
      transparent 40%
    );
  }

  .reply-form-active textarea {
    border-radius: 8px;
    border-color: var(--border-primary);
    padding: 8px;
    resize: vertical;
  }

  .reply-form textarea:focus {
    outline: none;
    border-color: var(--comment-highlight-active-border) !important;
    border-radius: 8px;
    padding: 8px;
  }
</style>
