<script lang="ts">
  import type { Comment, CommentReply } from '$lib/types'
  import { createEventDispatcher } from 'svelte'

  export let comment: Comment
  export let currentUserId: number

  const dispatch = createEventDispatcher()

  let replyText = ''
  let isReplying = false

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  function handleResolve() {
    dispatch('resolve', { commentId: comment.id })
  }

  function handleDelete() {
    dispatch('delete', { commentId: comment.id })
  }

  function handleSubmitReply() {
    if (replyText.trim()) {
      dispatch('reply', { commentId: comment.id, content: replyText.trim() })
      replyText = ''
      isReplying = false
    }
  }

  function handleCancelReply() {
    replyText = ''
    isReplying = false
  }
</script>

<div class="comment-thread" class:resolved={comment.resolved}>
  <div class="comment-header">
    <div class="author-info">
      <div
        class="author-avatar"
        style="background-color: {comment.author.color}"
        title={comment.author.username}
      >
        {comment.author.username.charAt(0).toUpperCase()}
      </div>
      <div class="author-details">
        <span class="author-name">{comment.author.username}</span>
        <span class="comment-time">{formatDate(comment.createdAt)}</span>
      </div>
    </div>
    <div class="comment-actions">
      {#if !comment.resolved}
        <button
          class="action-btn resolve-btn"
          on:click={handleResolve}
          title="Mark as resolved"
        >
          ✓
        </button>
      {/if}
      {#if comment.author.id === currentUserId}
        <button class="action-btn delete-btn" on:click={handleDelete} title="Delete comment">
          ×
        </button>
      {/if}
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
              style="background-color: {reply.author.color}"
              title={reply.author.username}
            >
              {reply.author.username.charAt(0).toUpperCase()}
            </div>
            <span class="reply-author">{reply.author.username}</span>
            <span class="reply-time">{formatDate(reply.createdAt)}</span>
          </div>
          <div class="reply-content">{reply.content}</div>
        </div>
      {/each}
    </div>
  {/if}

  {#if !comment.resolved}
    {#if isReplying}
      <div class="reply-form">
        <textarea
          bind:value={replyText}
          placeholder="Write a reply..."
          rows="2"
          autofocus
        />
        <div class="reply-form-actions">
          <button class="btn btn-cancel" on:click={handleCancelReply}>Cancel</button>
          <button class="btn btn-submit" on:click={handleSubmitReply} disabled={!replyText.trim()}>
            Reply
          </button>
        </div>
      </div>
    {:else}
      <button class="reply-btn" on:click={() => (isReplying = true)}>Reply</button>
    {/if}
  {/if}
</div>

<style>
  .comment-thread {
    background: var(--surface-primary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 12px;
    transition: opacity 0.2s;
  }

  .comment-thread.resolved {
    opacity: 0.6;
    background: var(--bg-primary);
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
  }

  .comment-time {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .comment-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 16px;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .resolve-btn:hover {
    color: var(--color-success);
  }

  .delete-btn:hover {
    color: var(--color-error);
  }

  .comment-content {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .replies {
    margin-top: 12px;
    padding-left: 12px;
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
  }

  .reply-author {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .reply-time {
    font-size: 10px;
    color: var(--text-secondary);
  }

  .reply-content {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-word;
    padding-left: 26px;
  }

  .reply-form {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .reply-form textarea {
    width: 100%;
    background: var(--surface-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    padding: 8px;
    color: var(--text-primary);
    font-size: 12px;
    font-family: inherit;
    resize: vertical;
  }

  .reply-form textarea:focus {
    outline: none;
    border-color: var(--color-primary-600);
  }

  .reply-form-actions {
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

  .reply-btn {
    margin-top: 8px;
    padding: 6px 12px;
    background: none;
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reply-btn:hover {
    background: var(--surface-secondary);
    border-color: var(--border-hover);
    color: var(--text-primary);
  }
</style>
