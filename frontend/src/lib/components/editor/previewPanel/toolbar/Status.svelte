<script lang="ts">
  import {
    compileStatus,
    previewStatus,
  } from "$lib/components/editor/context";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
</script>

<div class="status {$previewStatus}" title={$compileStatus}>
  {#if $previewStatus === "compiling"}
    <LoaderCircle size={13} class="spin" />
  {:else if $previewStatus === "error"}
    <CircleAlert size={13} />
  {:else if $previewStatus === "ready"}
    <CircleCheck size={13} />
  {/if}
  <span class="label">{$compileStatus || "Idle"}</span>
</div>

<style>
  .status {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    max-width: 14rem;
    padding: 0.1rem 0.5rem;
    border-radius: 0.4rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status.ready {
    color: var(--color-success);
  }

  .status.error {
    color: var(--color-error);
    background-color: var(--color-error-bg);
  }

  .status :global(svg) {
    flex-shrink: 0;
  }

  .status :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
