<script lang="ts">
  import type { Comment } from '$lib/types'
  import CommentThread from './CommentThread.svelte'

  interface CommentsPanelProps {
    comments?: Comment[]
    currentUserId: number
    newCommentDraft?: { text: string; range: { from: number; to: number }; selectedText: string } | null
    activeCommentId?: string | null
    hoveredCommentId?: string | null
    commentPositions?: Map<string, number>
    editorScrollTop?: number
    editorContentHeight?: number
    draftPosition?: number | null
    onResolve?: (commentId: string) => void
    onDelete?: (commentId: string) => void
    onReply?: (commentId: string, content: string) => void
    onSubmitNew?: (content: string) => void
    onCancelNew?: () => void
    onSelect?: (commentId: string) => void
    onHover?: (commentId: string) => void
    onHoverEnd?: (commentId: string) => void
    onPanelScroll?: (scrollTop: number) => void
  }

  let {
    comments = [],
    currentUserId,
    newCommentDraft = null,
    activeCommentId = null,
    hoveredCommentId = null,
    commentPositions = new Map(),
    editorScrollTop = 0,
    editorContentHeight = 2000,
    draftPosition = null,
    onResolve,
    onDelete,
    onReply,
    onSubmitNew,
    onCancelNew,
    onSelect,
    onHover,
    onHoverEnd,
    onPanelScroll,
  }: CommentsPanelProps = $props()

  let showResolved = $state(false)
  let draftCommentText = $state('')
  let panelScrollEl: HTMLElement | undefined = $state()
  let threadHeights = $state<Map<string, number>>(new Map())
  let isSyncingScroll = false

  let visibleComments = $derived(comments.filter((c) => showResolved || !c.resolved))
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

  // Sync panel scroll from editor scroll (one-way: editor → panel)
  $effect(() => {
    if (panelScrollEl && editorScrollTop != null) {
      // Guard to avoid loop when we're already syncing from panel → editor
      isSyncingScroll = true
      panelScrollEl.scrollTop = editorScrollTop
      requestAnimationFrame(() => { isSyncingScroll = false })
    }
  })

  function handlePanelScroll(e: Event) {
    if (isSyncingScroll) return
    const target = e.target as HTMLElement
    onPanelScroll?.(target.scrollTop)
  }

  // Compute positioned comments with overlap resolution
  // The active comment gets priority placement at its ideal position
  let positionedComments = $derived.by(() => {
    const MIN_GAP = 4

    type PositionedItem = {
      type: 'draft' | 'comment'
      comment?: Comment
      id: string
      idealTop: number
      actualTop: number
      height: number
    }

    const items: PositionedItem[] = []

    // Add draft if present
    if (newCommentDraft && draftPosition != null) {
      items.push({
        type: 'draft',
        id: '__draft__',
        idealTop: draftPosition,
        actualTop: draftPosition,
        height: threadHeights.get('__draft__') || 120,
      })
    }

    // Add visible comments that have positions
    for (const comment of visibleComments) {
      const pos = commentPositions.get(comment.id)
      if (pos != null) {
        items.push({
          type: 'comment',
          comment,
          id: comment.id,
          idealTop: pos,
          actualTop: pos,
          height: threadHeights.get(comment.id) || 80,
        })
      }
    }

    // Sort by ideal position
    items.sort((a, b) => a.idealTop - b.idealTop)

    // Find the active item index (selected comment gets priority)
    const activeIdx = items.findIndex(item => item.id === activeCommentId)

    if (activeIdx >= 0) {
      // Active comment stays at its ideal position
      items[activeIdx].actualTop = items[activeIdx].idealTop

      // Push items BELOW the active one downward
      for (let i = activeIdx + 1; i < items.length; i++) {
        const prev = items[i - 1]
        const minTop = prev.actualTop + prev.height + MIN_GAP
        if (items[i].actualTop < minTop) {
          items[i].actualTop = minTop
        }
      }

      // Push items ABOVE the active one upward
      for (let i = activeIdx - 1; i >= 0; i--) {
        const next = items[i + 1]
        const maxBottom = next.actualTop - MIN_GAP
        if (items[i].actualTop + items[i].height > maxBottom) {
          items[i].actualTop = maxBottom - items[i].height
        }
      }
    } else {
      // No active comment — simple top-down push
      for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1]
        const minTop = prev.actualTop + prev.height + MIN_GAP
        if (items[i].actualTop < minTop) {
          items[i].actualTop = minTop
        }
      }
    }

    return items
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

  function measureThread(el: HTMLElement, id: string) {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
        threadHeights.set(id, h)
        threadHeights = new Map(threadHeights)
      }
    })
    observer.observe(el)
    return {
      destroy() {
        observer.disconnect()
      }
    }
  }
</script>

<div class="comments-panel">
  {#if resolvedCount > 0}
    <div class="filter-section">
      <label class="filter-toggle">
        <input type="checkbox" bind:checked={showResolved} />
        <span>Show resolved ({resolvedCount})</span>
      </label>
    </div>
  {/if}

  <div class="panel-scroll" bind:this={panelScrollEl} onscroll={handlePanelScroll}>
    <div class="panel-content" style="height: {editorContentHeight}px;">
      {#each positionedComments as item (item.id)}
        {#if item.type === 'draft'}
          <div
            class="positioned-thread"
            style="top: {item.actualTop}px;"
            use:measureThread={'__draft__'}
          >
            <div class="new-comment-draft">
              <textarea
                class="new-comment-textarea"
                bind:value={draftCommentText}
                placeholder="Add your comment..."
                rows="2"
                onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitNewComment(); } if (e.key === 'Escape') { handleCancelNewComment(); } }}
              ></textarea>
              <div class="draft-actions">
                <button class="btn btn-cancel" onclick={handleCancelNewComment}>Cancel</button>
                <button class="btn btn-submit" onclick={handleSubmitNewComment} disabled={!draftCommentText.trim()}>
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
              {currentUserId}
              isActive={item.id === activeCommentId}
              isHovered={item.id === hoveredCommentId}
              {onResolve}
              {onDelete}
              {onReply}
              {onSelect}
              {onHover}
              {onHoverEnd}
            />
          </div>
        {/if}
      {/each}

      {#if visibleComments.length === 0 && !newCommentDraft}
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <p>No comments yet</p>
          <span>Select text to add a comment</span>
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
    color: var(--text-secondary);
    user-select: none;
  }

  .filter-toggle input[type='checkbox'] {
    cursor: pointer;
    width: 14px;
    height: 14px;
    accent-color: var(--color-primary-600);
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
    left: 4px;
    right: 4px;
    transition: top 0.2s ease-out;
  }

  .empty-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
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
