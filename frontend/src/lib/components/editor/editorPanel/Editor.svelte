<script lang="ts">
  import MessageSquarePlus from "@lucide/svelte/icons/message-square-plus";
  import {
    editorElement,
    showCommentButton,
    commentButtonPosition,
    canComment,
    addComment,
  } from "../context";
  import Button from "../leftPanel/Button.svelte";
</script>

<div class="container">
  <div bind:this={$editorElement} class="editor"></div>
  {#if $showCommentButton && $canComment}
    <div
      class="floating-comment-wrapper"
      class:show={$showCommentButton}
      style="position: absolute; top: {$commentButtonPosition.top}px; left: {$commentButtonPosition.left}px;"
    >
      <Button onclick={addComment}>
        <MessageSquarePlus />
      </Button>
    </div>
  {/if}
</div>

<style>
  .container {
    position: relative;
    height: 100%;
    width: 100%;
  }

  .editor {
    flex: 1;
    height: 100%;
    overflow: hidden;
    background-color: var(--bg-editor);
  }

  .editor :global(.cm-gutter) {
    background-color: var(--bg-editor);
  }

  .editor :global(.cm-gutters) {
    border: none;
  }

  .editor :global(.cm-scroller) {
    padding-top: 3rem;
  }

  :global([data-theme="dark"]) .editor :global(.cm-activeLine),
  :global([data-theme="dark"]) .editor :global(.cm-activeLineGutter) {
    background-color: #b0bac71a;
  }

  :global([data-theme="light"]) .editor :global(.cm-activeLine),
  :global([data-theme="light"]) .editor :global(.cm-activeLineGutter) {
    background-color: #06162f0b;
  }

  .editor :global(.cm-cursor) {
    border-left-color: var(--color-primary-500);
    border-left-width: 2px;
  }

  :global(.search-match) {
    background: yellow;
  }

  .floating-comment-wrapper {
    display: none;
  }

  .floating-comment-wrapper.show {
    display: block;
  }
</style>
