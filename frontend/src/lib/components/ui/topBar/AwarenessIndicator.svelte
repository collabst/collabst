<script lang="ts">
  import { projectYjs } from "$lib/components/editor/context/context";
  import { getProfilePicUrl } from "$lib/utils/urls";
  import VenetianMask from "@lucide/svelte/icons/venetian-mask";

  let awareness = $projectYjs?.provider.awareness;
  let awarenessStates: [number, any][] = $state([]);
  let loadedProfilePics = $state<Record<string, boolean>>({});

  function updateAwareness() {
    if (awareness) {
      awarenessStates = Array.from(awareness.getStates().entries());
    } else {
      awarenessStates = [];
    }
  }
  function getUserName(state: any) {
    return state?.user?.name || state?.user?.display_name || null;
  }

  $effect(() => {
    if (!awareness) {
      awarenessStates = [];
      return;
    }

    awareness.on("change", updateAwareness);
    updateAwareness();

    return () => {
      awareness.off("change", updateAwareness);
    };
  });

  let users = $derived(
    awarenessStates.filter(([_, state]) => getUserName(state)).slice(0, 10),
  );

  function profilePicSrc(userId: string) {
    return getProfilePicUrl(userId);
  }

  function handleAvatarLoad(userId: string) {
    loadedProfilePics = { ...loadedProfilePics, [userId]: true };
  }

  function hasLoadedAvatar(userId: string) {
    return !!loadedProfilePics[userId];
  }
</script>

<div class="awareness-indicator">
  {#each users as [clientId, state], index}
    <div
      class="avatar"
      style="background: {state.user?.color || '#999'}; z-index: {100 -
        index}; --avatar-glow: {state.user?.color || '#999'}70"
    >
      {#if state.user?.user_type === "guest"}
        <VenetianMask
          size={30}
          style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; opacity: 0.3;"
        />
      {/if}
      {#if state.user?.id}
        <span
          class="avatar-initial"
          class:avatar-initial-hidden={hasLoadedAvatar(state.user.id)}
        >
          {(getUserName(state) || "U")[0].toUpperCase()}
        </span>
        <img
          class="avatar-image"
          class:avatar-image-loaded={hasLoadedAvatar(state.user.id)}
          src={profilePicSrc(state.user.id)}
          alt={`${getUserName(state) || "User"} avatar`}
          onload={() => handleAvatarLoad(state.user.id)}
          onerror={() => {}}
        />
      {:else}
        <span class="avatar-initial">
          {(getUserName(state) || "U")[0].toUpperCase()}
        </span>
      {/if}
      <div class="tooltip">
        {#if state.user?.user_type === "guest"}
          <VenetianMask size={14} />
        {/if}
        {getUserName(state) || `User ${clientId}`}
      </div>
    </div>
  {/each}
</div>

<style>
  .awareness-indicator {
    display: flex;
    align-items: center;
  }

  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
    margin-left: -8px;
  }

  .avatar:first-child {
    margin-left: 0;
  }

  .avatar:hover {
    transform: scale(1.2) translateY(+5%);
    z-index: 200 !important;
    box-shadow: 0 1px 12px var(--avatar-glow);
    filter: saturate(1.7);
  }

  .avatar-initial {
    color: white;
    font-size: 14px;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .avatar-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    opacity: 0;
    overflow: hidden;
  }

  .avatar-image-loaded {
    opacity: 1;
  }

  .avatar-initial-hidden {
    opacity: 0;
  }

  .tooltip {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 8px;
    padding: 4px 8px;
    background: var(--bg-editor);
    color: var(--text-primary);
    font-size: 12px;
    font-weight: bold;
    white-space: nowrap;
    border-radius: 4px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
    border: 1px solid var(--border-primary);
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .tooltip::after {
    content: "";
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: var(--avatar-glow);
  }

  .avatar:hover .tooltip {
    opacity: 1;
    box-shadow: var(--shadow-lg);
  }
</style>
