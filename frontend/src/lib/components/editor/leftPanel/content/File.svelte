<script lang="ts">
  import type { File } from "$lib/components/editor/context/types";
  import { selectedFile, selectFile } from "$lib/components/editor/context";

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
  {file.path}
</button>

<style>
  .file {
    border: 1px transparent solid;
    border-bottom: 3px solid transparent;
    margin: 0 1rem;
    padding: 0.25rem 1rem;
    border-radius: 6px;
    background-color: transparent;
    justify-content: flex-start;
    display: flex;
    color: var(--text-secondary);
    box-sizing: border-box;
  }

  .file:hover {
    background-color: var(--surface-hover);
  }

  .file:active {
    transform: translateY(2px);

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

  .file.selected {
    font-weight: 600;
    border: 1px solid var(--navbar-border);
    border-bottom: 3px solid var(--navbar-border);
    background-color: var(--navbar-bg);
    animation: jumpAnimation 0.2s ease-out;
  }

  :global([data-theme="dark"]) .file.selected {
    color: var(--text-primary);
  }
</style>
