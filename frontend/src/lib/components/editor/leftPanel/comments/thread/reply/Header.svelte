<script lang="ts">
  import {
    isCommentorGuest,
    commentorName,
    formatCommentDate,
  } from "$lib/components/editor/context";
  import type { CommentReply } from "$lib/types";
  import Avatar from "../Avatar.svelte";
  import VenetianMask from "@lucide/svelte/icons/venetian-mask";

  interface Props {
    reply: CommentReply;
  }

  let { reply }: Props = $props();
</script>

<div class="reply-header">
  <Avatar userId={reply.authorId} />
  <div class="author-details">
    <div class="author-name">
      {#if isCommentorGuest(reply.authorId)}
        <VenetianMask size={16} />
      {/if}
      {commentorName(reply.authorId)}
    </div>
    <div class="reply-time">{formatCommentDate(reply.createdAt)}</div>
  </div>
</div>

<style>
  .reply-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .author-details {
    display: flex;
    flex-direction: column;
  }

  .reply-time {
    font-size: 11px;
    color: var(--text-secondary);
  }
</style>
