<script lang="ts">
  import type { Comment } from '$lib/types'
  import CommentThread from './CommentThread.svelte'
  import { createEventDispatcher } from 'svelte'

  export let comments: Comment[] = []
  export let currentUserId: number
  export let isOpen = true
  export let newCommentDraft: { text: string; range: { from: number; to: number }; selectedText: string } | null = null

  const dispatch = createEventDispatcher()

  let showResolved = false
  let draftCommentText = ''

  $: visibleComments = comments.filter((c) => showResolved || !c.resolved)
  $: unresolvedCount = comments.filter((c) => !c.resolved).length
  $: resolvedCount = comments.filter((c) => c.resolved).length

  // Focus and clear when draft changes
  $: if (newCommentDraft) {
    draftCommentText = ''
    setTimeout(() => {
      const textarea = document.querySelector('.new-comment-textarea') as HTMLTextAreaElement
      if (textarea) textarea.focus()
    }, 0)
  }

  function handleResolve(event: CustomEvent) {
    dispatch('resolve', event.detail)
  }

  function handleDelete(event: CustomEvent) {
    dispatch('delete', event.detail)
  }

  function handleReply(event: CustomEvent) {
    dispatch('reply', event.detail)
  }

  function togglePanel() {
    isOpen = !isOpen
  }

  function handleSubmitNewComment() {
    if (draftCommentText.trim()) {
      dispatch('submitNew', { content: draftCommentText.trim() })
      draftCommentText = ''
    }
  }

  function handleCancelNewComment() {
    draftCommentText = ''
    dispatch('cancelNew')
  }
</script>

<div class="comments-panel" class:open={isOpen}>
  <div class="panel-header">
    <div class="panel-title">
      <span>Comments</span>
      {#if unresolvedCount > 0}
        <span class="count-badge unresolved">{unresolvedCount}</span>
      {/if}
      {#if resolvedCount > 0 && showResolved}
        <span class="count-badge resolved">{resolvedCount}</span>
      {/if}
    </div>
    <button class="toggle-btn" on:click={togglePanel} title={isOpen ? 'Close' : 'Open'}>
      {isOpen ? '›' : '‹'}
    </button>
  </div>

  {#if isOpen}
    <div class="panel-content">
      {#if resolvedCount > 0}
        <div class="filter-section">
          <label class="filter-toggle">
            <input type="checkbox" bind:checked={showResolved} />
            <span>Show resolved ({resolvedCount})</span>
          </label>
        </div>
      {/if}

      {#if newCommentDraft}
        <div class="comments-list">
          <div class="new-comment-draft">
            <div class="draft-header">
              <span class="draft-label">New Comment</span>
              {#if newCommentDraft.selectedText}
                <div class="draft-selected-text">{newCommentDraft.selectedText}</div>
              {/if}
            </div>
            <textarea
              class="new-comment-textarea"
              bind:value={draftCommentText}
              placeholder="Add your comment..."
              rows="3"
            />
            <div class="draft-actions">
              <button class="btn btn-cancel" on:click={handleCancelNewComment}>Cancel</button>
              <button class="btn btn-submit" on:click={handleSubmitNewComment} disabled={!draftCommentText.trim()}>
                Comment
              </button>
            </div>
          </div>

          {#each visibleComments as comment (comment.id)}
            <CommentThread
              {comment}
              {currentUserId}
              on:resolve={handleResolve}
              on:delete={handleDelete}
              on:reply={handleReply}
            />
          {/each}
        </div>
      {:else if visibleComments.length === 0}
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <p>No comments yet</p>
          <span>Select text to add a comment</span>
        </div>
      {:else}
        <div class="comments-list">
          {#each visibleComments as comment (comment.id)}
            <CommentThread
              {comment}
              {currentUserId}
              on:resolve={handleResolve}
              on:delete={handleDelete}
              on:reply={handleReply}
            />
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .comments-panel {
    background: #1a1a1a;
    border-left: 1px solid #3e3e3e;
    display: flex;
    flex-direction: column;
    width: 320px;
    transition: width 0.3s ease;
    position: relative;
  }

  .comments-panel:not(.open) {
    width: 40px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #3e3e3e;
    background: #1e1e1e;
    min-height: 48px;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #e0e0e0;
    white-space: nowrap;
  }

  .comments-panel:not(.open) .panel-title {
    opacity: 0;
    pointer-events: none;
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
  }

  .count-badge.unresolved {
    background: #3b82f6;
    color: white;
  }

  .count-badge.resolved {
    background: #10b981;
    color: white;
  }

  .toggle-btn {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 20px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-btn:hover {
    background: #2e2e2e;
    color: #e0e0e0;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .filter-section {
    padding: 12px 16px;
    border-bottom: 1px solid #2e2e2e;
  }

  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    color: #d0d0d0;
    user-select: none;
  }

  .filter-toggle input[type='checkbox'] {
    cursor: pointer;
    width: 16px;
    height: 16px;
    accent-color: #4a9eff;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.3;
  }

  .empty-state p {
    font-size: 14px;
    color: #888;
    margin: 0 0 8px 0;
    font-weight: 500;
  }

  .empty-state span {
    font-size: 12px;
    color: #666;
  }

  .comments-list {
    padding: 16px;
    flex: 1;
  }

  .new-comment-draft {
    background: #1e1e1e;
    border: 2px solid #4a9eff;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .draft-header {
    margin-bottom: 8px;
  }

  .draft-label {
    font-size: 12px;
    font-weight: 600;
    color: #4a9eff;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .draft-selected-text {
    margin-top: 6px;
    padding: 8px;
    background: #2a2a2a;
    border-left: 3px solid #4a9eff;
    border-radius: 4px;
    font-size: 12px;
    color: #d0d0d0;
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 60px;
    overflow-y: auto;
  }

  .new-comment-textarea {
    width: 100%;
    background: #2a2a2a;
    border: 1px solid #3e3e3e;
    border-radius: 4px;
    padding: 8px;
    color: #e0e0e0;
    font-size: 13px;
    font-family: inherit;
    resize: vertical;
    margin-bottom: 8px;
  }

  .new-comment-textarea:focus {
    outline: none;
    border-color: #4a9eff;
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
    background: #2a2a2a;
    color: #d0d0d0;
  }

  .btn-cancel:hover {
    background: #3a3a3a;
  }

  .btn-submit {
    background: #4a9eff;
    color: white;
  }

  .btn-submit:hover:not(:disabled) {
    background: #3a8eef;
  }

  .btn-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Scrollbar styling */
  .panel-content::-webkit-scrollbar {
    width: 8px;
  }

  .panel-content::-webkit-scrollbar-track {
    background: #1a1a1a;
  }

  .panel-content::-webkit-scrollbar-thumb {
    background: #3e3e3e;
    border-radius: 4px;
  }

  .panel-content::-webkit-scrollbar-thumb:hover {
    background: #4e4e4e;
  }
</style>
