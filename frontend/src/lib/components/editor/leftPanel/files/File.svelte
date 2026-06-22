<script lang="ts">
  import type { File } from "$lib/components/editor/context/types";
  import { selectedFile, selectFile } from "$lib/components/editor/context";
  import FileIcon from "@lucide/svelte/icons/file";
  import Folder from "@lucide/svelte/icons/folder";

  interface Props {
    file: File;
  }
  let { file }: Props = $props();
  let selected = $derived(file.id === $selectedFile?.id);

  function handleClick() {
    selectFile(file.id);
  }
</script>

<button class="file" class:selected onclick={handleClick}>
  {#if file.is_folder}
    <Folder size={16} />
  {:else}
    <FileIcon size={16} />
  {/if}
  <span class="file-name">{file.path}</span>
</button>

<style>
  .file {
    border: 1px transparent solid;
    border-bottom: 3px solid transparent;
    margin: 0 1rem;
    padding: 0.3rem 1rem;
    border-radius: 6px;
    background-color: transparent;
    justify-content: flex-start;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    box-sizing: border-box;
  }

  .file :global(svg) {
    color: var(--text-tertiary);
  }

  .file:hover {
    background-color: var(--surface-hover);
  }

  .file:active .file-name {
    transform: translateY(2px);
  }

  .file:active :global(svg) {
    transform: scaleX(1.1) scaleY(0.9) translateY(2px);
  }

  @keyframes jumpAnimation {
    0% {
      transform: translateY(-3px);
    }
    80% {
      transform: translateY(1px);
    }
    100% {
      transform: none;
    }
  }

  @keyframes jumpAnimation2 {
    0% {
      transform: translateY(-4px) scaleX(0.8) scaleY(1.1);
    }
    80% {
      transform: translateY(2px) scaleX(1.1) scaleY(0.95);
    }
    100% {
      transform: none;
    }
  }

  .file.selected {
    font-weight: 600;
    border: 1px solid var(--navbar-border);
    border-bottom: 3px solid var(--navbar-border);
    background-color: var(--navbar-bg);
    animation: jumpAnimation 0.2s ease-out;
  }

  .file.selected :global(svg) {
    color: var(--text-primary);
    stroke-width: 2;
    animation: jumpAnimation2 0.25s ease-in-out;
  }

  :global([data-theme="dark"]) .file.selected {
    color: var(--text-primary);
  }
</style>
