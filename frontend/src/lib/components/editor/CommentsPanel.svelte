<script lang="ts">
  import type { Comment } from '$lib/types'
  import CommentThread from './CommentThread.svelte'

  interface CommentsPanelProps {
    comments?: Comment[]
    currentUserId: number
    newCommentDraft?: { text: string; range: { from: number; to: number }; selectedText: string } | null
    activeCommentId?: string | null
    onResolve?: (commentId: string) => void
    onDelete?: (commentId: string) => void
    onReply?: (commentId: string, content: string) => void
    onSubmitNew?: (content: string) => void
    onCancelNew?: () => void
    onSelect?: (commentId: string) => void
  }

  let {
    comments = [],
    currentUserId,
    newCommentDraft = null,
    activeCommentId = null,
    onResolve,
    onDelete,
    onReply,
    onSubmitNew,
    onCancelNew,
    onSelect,
  }: CommentsPanelProps = $props()

  let showResolved = $state(false)
  let draftCommentText = $state('')

  let visibleComments = $derived(comments.filter((c) => showResolved || !c.resolved))
  let unresolvedCount = $derived(comments.filter((c) => !c.resolved).length)
  let resolvedCount = $derived(comments.filter((c) => c.resolved).length)

  // Focus and clear when draft changes
  $effect(() => {
    if (newCommentDraft) {
      draftCommentText = ''
      setTimeout(() => {
        const textarea = document.querySelector('.new-comment-textarea') as HTMLTextAreaElement
        if (textarea) textarea.focus()
      }, 0)
    }
  })

  function handleSubmitNewComment() {
    if (draftCommentText.trim()) {
      onSubmitNew?.(draftCommentText.trim())
      draftCommentText = ''
    }
  }

  function handleCancelNewComment() {
    draftCommentText = ''
    onCancelNew?.()
  }
</script>

<div class="comments-panel">
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
            <button class="btn btn-cancel" onclick={handleCancelNewComment}>Cancel</button>
            <button class="btn btn-submit" onclick={handleSubmitNewComment} disabled={!draftCommentText.trim()}>
              Comment
            </button>
          </div>
        </div>

        {#each visibleComments as comment (comment.id)}
          <CommentThread
            {comment}
            {currentUserId}
            isActive={comment.id === activeCommentId}
            {onResolve}
            {onDelete}
            {onReply}
            {onSelect}
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
            isActive={comment.id === activeCommentId}
            {onResolve}
            {onDelete}
            {onReply}
            {onSelect}
          />
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .comments-panel {
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .filter-section {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-primary);
  }

  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-primary);
    user-select: none;
  }

  .filter-toggle input[type='checkbox'] {
    cursor: pointer;
    width: 16px;
    height: 16px;
    accent-color: var(--color-primary-600);
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
    color: var(--text-secondary);
    margin: 0 0 8px 0;
    font-weight: 500;
  }

  .empty-state span {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .comments-list {
    padding: 16px;
    flex: 1;
  }

  .new-comment-draft {
    background: var(--surface-primary);
    border: 2px solid var(--color-primary-600);
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
    color: var(--color-primary-600);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .draft-selected-text {
    margin-top: 6px;
    padding: 8px;
    background: var(--surface-secondary);
    border-left: 3px solid var(--color-primary-600);
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-primary);
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 60px;
    overflow-y: auto;
  }

  .new-comment-textarea {
    width: 100%;
    background: var(--surface-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    padding: 8px;
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
    resize: vertical;
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

  /* Scrollbar styling */
  .panel-content::-webkit-scrollbar {
    width: 8px;
  }

  .panel-content::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .panel-content::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }

  .panel-content::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }
</style>
