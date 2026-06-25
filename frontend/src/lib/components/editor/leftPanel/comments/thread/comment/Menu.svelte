<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import {
    canManageProject,
    canComment,
    resolveComment,
    reopenComment,
    deleteComment,
  } from "$lib/components/editor/context";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import type { Comment } from "$lib/types";

  interface Props {
    comment: Comment;
  }

  let { comment }: Props = $props();

  let canDeleteThisComment = $derived(
    $canManageProject || comment.authorId === $auth.user?.id,
  );
  let showMenu = $state(false);

  $effect(() => {
    if (showMenu) {
      document.addEventListener("click", closeMenu);
    } else {
      document.removeEventListener("click", closeMenu);
    }
  });

  function handleMenuClick(e: MouseEvent) {
    e.stopPropagation();
    toggleMenu();
  }

  function toggleMenu() {
    showMenu = !showMenu;
  }

  function closeMenu() {
    showMenu = false;
  }

  function handleResolve() {
    resolveComment(comment.id);
    closeMenu();
  }

  function handleReopen() {
    reopenComment(comment.id);
    closeMenu();
  }

  function handleDelete() {
    deleteComment(comment.id);
    closeMenu();
  }
</script>

<div class="menu-container">
  {#if $canComment}
    <button class="menu-btn" onclick={handleMenuClick}>
      <Ellipsis size={16} />
    </button>
  {/if}
  {#if $canComment && showMenu}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="menu-backdrop" onclick={closeMenu}></div>
    <div class="menu-dropdown">
      {#if !comment.resolved}
        <button class="menu-item" onclick={handleResolve}>
          <span class="menu-icon">✓</span> Resolve
        </button>
      {:else}
        <button class="menu-item" onclick={handleReopen}>
          <span class="menu-icon">⟳</span> Reopen
        </button>
      {/if}
      {#if canDeleteThisComment}
        <button class="menu-item menu-item-danger" onclick={handleDelete}>
          <span class="menu-icon">✕</span> Delete
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .menu-container {
    position: absolute;
    top: 8px;
    right: 8px;
  }

  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .menu-dropdown {
    position: absolute;
    right: 0;
    top: 100%;
    margin-top: 4px;
    background: var(--surface-primary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 4px;
    min-width: 120px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.1s;
  }

  .menu-item:hover {
    background: var(--surface-hover);
  }

  .menu-item-danger:hover {
    color: var(--color-error);
  }

  .menu-icon {
    font-size: 12px;
    width: 16px;
    text-align: center;
  }

  .menu-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 50%;
    font-size: 18px;
    transition: none;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.3rem;
  }

  .menu-btn:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .menu-btn:active {
    transform: scaleX(1.1) scaleY(0.9);
  }
</style>
