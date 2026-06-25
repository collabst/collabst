<script lang="ts">
  import {
    comments,
    commentDraft,
    submitNewComment,
    cancelNewComment,
  } from "$lib/components/editor/context";
  import CommentThread from "./thread/Thread.svelte";
</script>

<div class="content">
  {#if $commentDraft}
    <div class="draft-comment">
      <textarea bind:value={$commentDraft.text} placeholder="Write a comment..."
      ></textarea>
      <button onclick={submitNewComment}>Submit</button>
      <button onclick={cancelNewComment}>Cancel</button>
    </div>
  {/if}

  {#each $comments as comment (comment.id)}
    <div class="comment">
      <CommentThread {comment} />
    </div>
  {/each}
</div>
