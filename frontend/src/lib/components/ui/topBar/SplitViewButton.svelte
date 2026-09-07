<script lang="ts">
  import {
    closeSeparatePreview,
    separatePreviewOpen,
  } from "$lib/components/editor/context";
  import TopButton from "./TopButton.svelte";
  import Columns2 from "@lucide/svelte/icons/columns-2";
</script>

<!--
  The only way back from the popped-out preview: while it is open the split
  view has no preview column, and so no preview toolbar, to hold this.
-->
{#if $separatePreviewOpen}
  <TopButton onclick={closeSeparatePreview} title="Back to split view">
    <Columns2 />
  </TopButton>
{/if}
