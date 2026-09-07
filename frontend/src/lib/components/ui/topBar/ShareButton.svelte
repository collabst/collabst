<script lang="ts">
  import { project } from "$lib/components/editor/context";
  import { openShareDialog } from "$lib/components/projects/sharing/context";
  import TopButton from "./TopButton.svelte";
  import Share2 from "@lucide/svelte/icons/share-2";
</script>

<TopButton onclick={() => openShareDialog($project)}>
  <Share2 />
</TopButton>
