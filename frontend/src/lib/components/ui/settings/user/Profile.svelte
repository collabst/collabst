<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { savingDisplayName, updateDisplayName } from "../context";
  import Avatar from "./Avatar.svelte";
  import Pencil from "@lucide/svelte/icons/pencil";

  let editing = $state(false);
  let draft = $state("");
  let input: HTMLInputElement | undefined = $state();

  function startEditing() {
    draft = $auth.user?.display_name ?? "";
    editing = true;
    queueMicrotask(() => input?.select());
  }

  async function commit() {
    if (await updateDisplayName(draft)) editing = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      editing = false;
    }
  }
</script>

<section class="profile">
  <Avatar />

  <div class="identity">
    {#if editing}
      <input
        bind:this={input}
        bind:value={draft}
        onkeydown={handleKeydown}
        onblur={commit}
        disabled={$savingDisplayName}
        aria-label="Display name"
      />
    {:else}
      <button class="name" onclick={startEditing} title="Change display name">
        {$auth.user?.display_name || "User"}
        <Pencil size={13} />
      </button>
    {/if}

    {#if $auth.user?.email}
      <span class="meta">{$auth.user.email}</span>
    {/if}
    {#if $auth.user?.user_type === "guest"}
      <span class="meta">Guest account</span>
    {:else if $auth.user?.created_at}
      <span class="meta">
        Joined {new Date($auth.user.created_at).toLocaleDateString()}
      </span>
    {/if}
  </div>
</section>

<style>
  .profile {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .identity {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .name {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.1rem 0.3rem;
    margin-left: -0.3rem;
    border: 1px solid transparent;
    border-radius: 0.45rem;
    background: transparent;
    color: var(--text-primary);
    font: inherit;
    font-size: 1.05rem;
    font-weight: 700;
    cursor: text;
  }

  .name :global(svg) {
    color: var(--text-tertiary);
    opacity: 0;
  }

  .name:hover {
    border-color: var(--navbar-border);
    background-color: var(--surface-hover);
  }

  .name:hover :global(svg) {
    opacity: 1;
  }

  input {
    padding: 0.25rem 0.4rem;
    border: 1px solid var(--color-tertiary-500);
    border-radius: 0.45rem;
    background-color: var(--bg-input);
    color: var(--text-primary);
    font: inherit;
    font-size: 1.05rem;
    font-weight: 700;
  }

  .meta {
    font-size: 0.8rem;
    color: var(--text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
