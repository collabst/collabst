<script lang="ts">
  import {
    closeSeparatePreview,
    separatePreviewOpen,
  } from "$lib/components/editor/context";
  import Columns2 from "@lucide/svelte/icons/columns-2";
</script>

<!--
  While the preview lives in its own window the panel's iframe is idle, so it is
  covered rather than unmounted — unmounting would drop the `previewIframe`
  binding the panel needs back when the window closes.
-->
{#if $separatePreviewOpen}
  <div class="overlay">
    <p class="title">Previewing in a separate window</p>
    <button class="back" onclick={closeSeparatePreview}>
      <Columns2 size={16} /> Back to split view
    </button>
  </div>
{/if}

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background-color: var(--bg-preview, var(--bg-primary));
  }

  .title {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .back {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.85rem;
    border: 1px solid var(--navbar-border);
    border-radius: 0.7rem;
    background-color: var(--navbar-bg);
    box-shadow: inset 0 -3px 0 0 var(--navbar-shadow);
    color: var(--text-primary);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .back:active {
    box-shadow: inset 0 3px 0 0 var(--navbar-shadow);
    transform: translateY(1px);
  }
</style>
