<script lang="ts">
  import type { Comment } from "$lib/types";
  import {
    activeCommentId,
    selectComment,
    canComment,
    hoverComment,
    replyComment,
  } from "$lib/components/editor/context";
  import CommentHeader from "./comment/Header.svelte";
  import ReplyHeader from "./reply/Header.svelte";
  import Menu from "./comment/Menu.svelte";

  interface Props {
    comment: Comment;
  }

  let { comment }: Props = $props();

  let isActive = $derived($activeCommentId === comment.id);
  let replyText = $state("");

  function handleReplyKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !(e.shiftKey || e.ctrlKey)) {
      replyComment(comment.id, replyText);
      replyText = "";
      e.preventDefault();
    }
    if (e.key === "Escape") {
      replyText = "";
    }
  }
</script>

<button
  class="comment-thread"
  class:resolved={comment.resolved}
  class:active={isActive}
  onclick={() => selectComment(comment)}
  onmouseenter={() => hoverComment(comment.id)}
  onmouseleave={() => hoverComment(null)}
>
  <Menu {comment} />

  <CommentHeader {comment} />
  <div class="comment-content">
    {comment.content}
  </div>

  {#if comment.replies.length > 0}
    <div class="replies">
      {#each comment.replies as reply}
        <div class="reply">
          <ReplyHeader {reply} />
          <div class="reply-content">{reply.content}</div>
        </div>
      {/each}
    </div>
  {/if}

  {#if $canComment && !comment.resolved}
    <textarea
      bind:value={replyText}
      class="reply-form"
      placeholder="Reply..."
      rows="1"
      onkeydown={handleReplyKeydown}
    ></textarea>
  {/if}
</button>

<style>
  .comment-thread {
    position: relative;
    background: var(--bg-editor);
    border: 1px solid var(--border-tertiary);
    border-radius: 10px;
    padding: 8px;
    margin-bottom: 6px;
    transition: opacity 1s;
    width: 100%;
    text-align: left;
  }

  .comment-thread.resolved {
    opacity: 0.7;
    background: var(--bg-primary);
  }

  .comment-thread:hover {
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

  .reply-content {
    font-size: 12px;
    color: var(--text-primary);
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-word;
    padding-left: 3px;
  }

  .reply-form {
    display: none;
    margin-top: 8px;
    flex-direction: column;
    gap: 8px;
  }

  .comment-thread:hover .reply-form,
  .comment-thread.active .reply-form {
    display: flex;
  }

  .reply-form {
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
</style>
