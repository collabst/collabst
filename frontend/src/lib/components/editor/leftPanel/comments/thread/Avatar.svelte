<script lang="ts">
  import {
    commentorColor,
    commentorName,
  } from "$lib/components/editor/context";
  import { getProfilePicUrl } from "$lib/utils/urls";

  interface Props {
    userId: string;
  }

  let { userId }: Props = $props();

  let loaded = $state(false);

  function handleAvatarLoad() {
    loaded = true;
  }
</script>

<div class="avatar" style="--color: {commentorColor(userId)};">
  {#if !loaded}
    <div class="fallback">
      {commentorName(userId).charAt(0).toUpperCase()}
    </div>
  {:else}
    <img
      class="image"
      src={getProfilePicUrl(userId)}
      alt={`${commentorName(userId)} avatar`}
      onload={handleAvatarLoad}
    />
  {/if}
</div>

<style>
  .avatar {
    position: relative;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
  }

  .fallback {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--color);
    color: white;
  }

  .image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
