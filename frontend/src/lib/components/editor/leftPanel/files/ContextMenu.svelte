<script lang="ts">
  import {
    canWrite,
    closeFileMenu,
    type ExplorerNode,
    fileMenu,
    newFileNextTo,
    newFolderNextTo,
    requestDeletion,
    setMainFile,
    startRenaming,
    uploadAssetsNextTo,
  } from "$lib/components/editor/context";
  import FilePlus from "@lucide/svelte/icons/file-plus";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Star from "@lucide/svelte/icons/star";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Upload from "@lucide/svelte/icons/upload";

  let menuElement: HTMLDivElement | undefined = $state();
  let node = $derived($fileMenu?.node ?? null);
  // A `.typ` file is the only thing that can be a compiler entry point.
  let canBeMainFile = $derived(
    node !== null &&
      node.kind === "file" &&
      !node.is_folder &&
      node.name.toLowerCase().endsWith(".typ"),
  );

  // Keep the card inside the viewport: opened near the bottom or the right edge
  // it would otherwise hang off the screen.
  let position = $state({ top: 0, left: 0 });
  $effect(() => {
    const menu = $fileMenu;
    if (!menu || !menuElement) return;
    const { width, height } = menuElement.getBoundingClientRect();
    position = {
      left: Math.min(menu.x, window.innerWidth - width - 8),
      top: Math.min(menu.y, window.innerHeight - height - 8),
    };
  });

  // The menu closes before the action runs, and `node` is derived from the very
  // store that closing clears — so the target is read once, here, and handed to
  // the action rather than looked up again inside it.
  function run(action: (target: ExplorerNode | null) => void) {
    const target = node;
    closeFileMenu();
    action(target);
  }

  // The input lives outside the menu's `{#if}` so it is still in the document
  // when the file dialog comes back with a selection.
  let uploadInput: HTMLInputElement | undefined = $state();
  let uploadNodeId: string | null = null;

  function handleUploadHere() {
    uploadNodeId = node?.id ?? null;
    closeFileMenu();
    uploadInput?.click();
  }

  function handleUploadChange() {
    if (!uploadInput?.files) return;
    uploadAssetsNextTo(Array.from(uploadInput.files), uploadNodeId);
    uploadInput.value = "";
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") closeFileMenu();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $fileMenu}
  <button
    class="backdrop"
    aria-label="Close menu"
    onclick={closeFileMenu}
    oncontextmenu={(e) => {
      e.preventDefault();
      closeFileMenu();
    }}
  ></button>
  <div
    bind:this={menuElement}
    class="menu"
    style="top: {position.top}px; left: {position.left}px;"
  >
    {#if node}
      <div class="menu-title">{node.name}</div>
      <div class="divider"></div>
    {/if}
    <button
      class="item"
      disabled={!$canWrite}
      onclick={() => run((target) => newFileNextTo(target?.id ?? null))}
    >
      <FilePlus size={15} /> New file
    </button>
    <button
      class="item"
      disabled={!$canWrite}
      onclick={() => run((target) => newFolderNextTo(target?.id ?? null))}
    >
      <FolderPlus size={15} /> New folder
    </button>
    <button class="item" disabled={!$canWrite} onclick={handleUploadHere}>
      <Upload size={15} /> Upload here
    </button>
    {#if node}
      <div class="divider"></div>
      <button
        class="item"
        disabled={!$canWrite}
        onclick={() => run((target) => {
          if (target) startRenaming(target.id);
        })}
      >
        <Pencil size={15} /> Rename
      </button>
      {#if canBeMainFile}
        <button
          class="item"
          onclick={() => run((target) => {
            if (target) setMainFile(target.id);
          })}
        >
          <Star size={15} /> Set as main file
        </button>
      {/if}
      <button
        class="item danger"
        disabled={!$canWrite}
        onclick={() => run((target) => {
          if (target) requestDeletion(target);
        })}
      >
        <Trash2 size={15} /> Delete
      </button>
    {/if}
  </div>
{/if}

<input
  bind:this={uploadInput}
  type="file"
  multiple
  hidden
  onchange={handleUploadChange}
/>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    border: none;
    background: transparent;
    cursor: default;
  }

  .menu {
    position: fixed;
    z-index: 41;
    min-width: 12rem;
    display: flex;
    flex-direction: column;
    padding: 0.35rem;
    border-radius: 0.75rem;
    background-color: color-mix(in srgb, var(--navbar-bg), transparent 10%);
    backdrop-filter: blur(12px);
    border: 1px solid var(--navbar-border);
    box-shadow:
      0 3px 0 0 var(--navbar-shadow),
      0 12px 28px -12px rgb(0 0 0 / 0.35);
  }

  .menu-title {
    padding: 0.25rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .divider {
    height: 1px;
    background-color: var(--navbar-border);
    margin: 0.25rem 0.35rem;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--text-secondary);
    font: inherit;
    font-size: 0.85rem;
    text-align: left;
    cursor: pointer;
  }

  .item :global(svg) {
    color: var(--text-tertiary);
    flex-shrink: 0;
  }

  .item:hover:not(:disabled) {
    background-color: var(--surface-hover);
    color: var(--text-primary);
  }

  .item:hover:not(:disabled) :global(svg) {
    color: var(--text-primary);
  }

  .item:active:not(:disabled) {
    transform: translateY(1px);
  }

  .item:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .item.danger:hover:not(:disabled),
  .item.danger:hover:not(:disabled) :global(svg) {
    color: var(--color-error);
  }
</style>
