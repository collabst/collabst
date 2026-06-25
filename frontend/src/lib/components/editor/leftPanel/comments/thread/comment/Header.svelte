<script lang="ts">
  import type { Comment } from "$lib/types";
  import {
    isCommentorGuest,
    commentorName,
    formatCommentDate,
  } from "$lib/components/editor/context";
  import VenetianMask from "@lucide/svelte/icons/venetian-mask";
  import Avatar from "../Avatar.svelte";

  interface Props {
    comment: Comment;
  }

  let { comment }: Props = $props();
</script>

<div class="comment-header">
  <div class="author-info">
    <Avatar userId={comment.authorId} />
    <div class="author-details">
      <span class="author-name">
        {#if isCommentorGuest(comment.authorId)}
          <VenetianMask size={16} />
        {/if}
        {commentorName(comment.authorId)}
      </span>
      <span class="comment-time">{formatCommentDate(comment.createdAt)}</span>
    </div>
  </div>
</div>

<style>
  .comment-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .author-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .author-details {
    display: flex;
    flex-direction: column;
  }

  .comment-time {
    font-size: 11px;
    color: var(--text-secondary);
  }
</style>
