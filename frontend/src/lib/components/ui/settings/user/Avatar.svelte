<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { getProfilePicUrl } from "$lib/utils/urls";
  import {
    avatarVersion,
    removeAvatar,
    savingAvatar,
    uploadAvatar,
  } from "../context";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  let loaded = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();

  // A fresh URL (new user or new upload) is unproven until `onload` fires.
  let src = $derived(
    $auth.user?.id
      ? `${getProfilePicUrl($auth.user.id)}?v=${$avatarVersion}`
      : "",
  );
  $effect(() => {
    void src;
    loaded = false;
  });

  let initial = $derived(($auth.user?.display_name || "U")[0].toUpperCase());
  let canEdit = $derived($auth.user?.user_type === "auth");

  function handleFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void uploadAvatar(file);
    input.value = "";
  }
</script>

<div class="avatar">
  <span class="initial" class:hidden={loaded}>{initial}</span>
  {#if src}
    <img
      class="picture"
      class:loaded
      {src}
      alt=""
      onload={() => (loaded = true)}
      onerror={() => (loaded = false)}
    />
  {/if}

  {#if canEdit}
    <div class="overlay">
      <button
        class="action"
        onclick={() => fileInput?.click()}
        disabled={$savingAvatar}
        aria-label="Change profile picture"
        title="Change profile picture"
      >
        <Pencil size={14} />
      </button>
      {#if loaded}
        <button
          class="action danger"
          onclick={() => void removeAvatar()}
          disabled={$savingAvatar}
          aria-label="Remove profile picture"
          title="Remove profile picture"
        >
          <Trash2 size={14} />
        </button>
      {/if}
    </div>
  {/if}
</div>

<input
  bind:this={fileInput}
  type="file"
  accept="image/*"
  hidden
  onchange={handleFile}
/>

<style>
  .avatar {
    position: relative;
    width: 72px;
    height: 72px;
    flex-shrink: 0;
    overflow: hidden;
    border: 1px solid var(--navbar-border);
    border-radius: 999px;
    background-color: var(--navbar-bg);
  }

  .initial {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    font-size: 1.75rem;
    color: var(--text-secondary);
  }

  .initial.hidden {
    opacity: 0;
  }

  .picture {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
  }

  .picture.loaded {
    opacity: 1;
  }

  .overlay {
    position: absolute;
    inset: auto 0 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.2rem 0;
    background-color: rgb(0 0 0 / 0.45);
    opacity: 0;
  }

  .avatar:hover .overlay,
  .avatar:focus-within .overlay {
    opacity: 1;
  }

  .action {
    display: flex;
    padding: 0.15rem;
    border: none;
    border-radius: 0.35rem;
    background: transparent;
    color: #fff;
    cursor: pointer;
  }

  .action:hover:not(:disabled) {
    background-color: rgb(255 255 255 / 0.2);
  }

  .action.danger:hover:not(:disabled) {
    color: var(--color-error);
  }

  .action:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
