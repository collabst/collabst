<script lang="ts">
  import {
    cancelNewComment,
    commentDraft,
    comments,
    showResolvedComments,
    submitNewComment,
  } from "$lib/components/editor/context";
  import CommentThread from "./thread/Thread.svelte";

  let visibleComments = $derived(
    $comments.filter((comment) => $showResolvedComments || !comment.resolved),
  );

  function handleDraftKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !(event.shiftKey || event.ctrlKey)) {
      event.preventDefault();
      submitNewComment();
    }
    if (event.key === "Escape") {
      cancelNewComment();
    }
  }
</script>

<div class="content">
  {#if $commentDraft}
    <div class="draft">
      {#if $commentDraft.selectedText}
        <div class="quote">{$commentDraft.selectedText}</div>
      {/if}
      <!-- svelte-ignore a11y_autofocus -->
      <textarea
        bind:value={$commentDraft.text}
        class="draft-input"
        placeholder="Write a comment…"
        rows="3"
        autofocus
        onkeydown={handleDraftKeydown}
      ></textarea>
      <div class="draft-actions">
        <button class="draft-button" onclick={cancelNewComment}>Cancel</button>
        <button
          class="draft-button primary"
          disabled={!$commentDraft.text.trim()}
          onclick={submitNewComment}
        >
          Comment
        </button>
      </div>
    </div>
  {/if}

  {#each visibleComments as comment (comment.id)}
    <div class="comment">
      <CommentThread {comment} />
    </div>
  {/each}

  {#if visibleComments.length === 0 && !$commentDraft}
    <div class="empty">
      {#if $comments.length > 0}
        Every thread on this file is resolved.
      {:else}
        No comments on this file yet.
      {/if}
    </div>
  {/if}
</div>

<style>
  .content {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding: 0 1rem 5rem;
    gap: 0.25rem;
  }

  .draft {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.6rem;
    margin-bottom: 0.5rem;
    border-radius: 10px;
    background: var(--bg-editor);
    border: 1px solid var(--comment-highlight-active-border);
    box-shadow: 0 2px 0px var(--comment-highlight-active-border);
  }

  .quote {
    font-size: 12px;
    color: var(--text-tertiary);
    border-left: 2px solid var(--border-primary);
    padding-left: 0.5rem;
    max-height: 4.5em;
    overflow: hidden;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .draft-input {
    width: 100%;
    background: var(--surface-hover);
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 6px 10px;
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
    resize: none;
  }

  .draft-input:focus {
    outline: none;
    border-color: var(--comment-highlight-active-border);
  }

  .draft-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  .draft-button {
    padding: 0.3rem 0.7rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border-tertiary);
    background: transparent;
    color: var(--text-secondary);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  .draft-button:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .draft-button:active:not(:disabled) {
    transform: translateY(1px);
  }

  .draft-button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .draft-button.primary {
    color: var(--text-primary);
    border-color: var(--comment-highlight-active-border);
    background: color-mix(
      in srgb,
      var(--comment-highlight-active-bg),
      var(--bg-editor) 70%
    );
  }

  .empty {
    padding: 1rem 0.5rem;
    color: var(--text-tertiary);
    font-size: 0.85rem;
    text-align: center;
  }
</style>
