<script lang="ts">
  import {
    canDropOnNode,
    canWrite,
    draggedNodeId,
    dropOnNode,
    endNodeDrag,
    type ExplorerNode,
    mainFile,
    openFileMenu,
    renameAsset,
    renameFile,
    selectAsset,
    renamingNodeId,
    selectFile,
    selectedAsset,
    selectedFile,
    startNodeDrag,
    startRenaming,
    stopRenaming,
    toggleFolder,
    uploadAssetsNextTo,
  } from "$lib/components/editor/context";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import FileIcon from "@lucide/svelte/icons/file";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Image from "@lucide/svelte/icons/image";
  import Star from "@lucide/svelte/icons/star";

  interface Props {
    node: ExplorerNode;
  }
  let { node }: Props = $props();

  let selected = $derived(
    node.kind === "asset"
      ? node.id === $selectedAsset?.id
      : node.id === $selectedFile?.id && $selectedAsset === null,
  );
  let renaming = $derived($renamingNodeId === node.id);
  // The entry point the compiler builds — worth marking, because every other
  // `.typ` file in the tree looks exactly like it.
  let isMainFile = $derived(node.kind === "file" && node.id === $mainFile?.id);

  let draft = $state("");
  let inputElement: HTMLInputElement | undefined = $state();
  // Escape unmounts the input, and a removed element's `blur` is not something
  // to rely on either way — so the cancel is remembered rather than inferred.
  let cancelled = false;

  $effect(() => {
    if (renaming) {
      draft = node.name;
      cancelled = false;
    }
  });

  $effect(() => {
    if (!renaming || !inputElement) return;
    inputElement.focus();
    // Select the stem only: the extension is almost never the part being changed.
    const dot = node.name.lastIndexOf(".");
    inputElement.setSelectionRange(0, dot > 0 ? dot : node.name.length);
  });

  function handleClick() {
    if (node.is_folder) {
      toggleFolder(node.id);
      return;
    }
    if (node.kind === "asset") {
      selectAsset(node.id);
      return;
    }
    selectFile(node.id);
  }

  // Two kinds of drag reach a row: OS files (an upload — folders only, anything
  // else lets it bubble to the panel and land at the root) and another row (a
  // move). `dataTransfer` refuses to reveal its payload during `dragover`, so
  // the move case is recognised from the context store instead.
  let dragDepth = $state(0);
  let dropKind: "upload" | "move" | null = $state(null);
  let dropTarget = $derived(dragDepth > 0 && dropKind !== null);
  let dragged = $derived($draggedNodeId === node.id);

  function isUploadDrag(event: DragEvent) {
    return (
      node.is_folder &&
      $canWrite &&
      Array.from(event.dataTransfer?.types ?? []).includes("Files")
    );
  }

  function accepts(event: DragEvent): "upload" | "move" | null {
    if ($draggedNodeId !== null) {
      return canDropOnNode(node.id) ? "move" : null;
    }
    return isUploadDrag(event) ? "upload" : null;
  }

  // A move that this row refuses must not fall through to the panel behind it —
  // dropping on a sibling would then silently move the node to the root.
  function claimsMoveDrag(event: DragEvent) {
    if ($draggedNodeId === null) return;
    event.stopPropagation();
  }

  function handleDragStart(event: DragEvent) {
    if (!$canWrite) {
      event.preventDefault();
      return;
    }
    startNodeDrag(node.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      // Firefox will not start a drag at all without a payload on the transfer.
      event.dataTransfer.setData("text/plain", node.name);
    }
  }

  function handleDragEnd() {
    endNodeDrag();
    dragDepth = 0;
    dropKind = null;
  }

  function handleDragEnter(event: DragEvent) {
    claimsMoveDrag(event);
    const kind = accepts(event);
    if (!kind) return;
    dropKind = kind;
    dragDepth += 1;
  }

  function handleDragOver(event: DragEvent) {
    claimsMoveDrag(event);
    const kind = accepts(event);
    if (!kind) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = kind === "move" ? "move" : "copy";
    }
  }

  function handleDragLeave() {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropKind = null;
  }

  function handleDrop(event: DragEvent) {
    const kind = accepts(event);
    dragDepth = 0;
    dropKind = null;
    if (!kind) return;
    event.preventDefault();
    event.stopPropagation();
    if (kind === "move") {
      dropOnNode(node.id);
      return;
    }
    const dropped = Array.from(event.dataTransfer?.files ?? []);
    if (dropped.length > 0) uploadAssetsNextTo(dropped, node.id);
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    openFileMenu({ node, x: event.clientX, y: event.clientY });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "F2") {
      event.preventDefault();
      startRenaming(node.id);
    }
  }

  function commit() {
    if (cancelled) return;
    const name = draft.trim();
    stopRenaming();
    if (!name || name === node.name) return;
    if (node.kind === "asset") {
      renameAsset(node.id, name);
    } else {
      renameFile(node.id, name);
    }
  }

  function handleInputKeydown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelled = true;
      stopRenaming();
    }
  }
</script>

{#snippet icon()}
  <span class="chevron" class:expanded={node.isExpanded}>
    {#if node.is_folder}
      <ChevronRight size={14} />
    {/if}
  </span>
  {#if node.is_folder}
    {#if node.isExpanded}
      <FolderOpen size={16} />
    {:else}
      <Folder size={16} />
    {/if}
  {:else if node.kind === "asset"}
    <Image size={16} />
  {:else}
    <FileIcon size={16} />
  {/if}
{/snippet}

{#if renaming}
  <div class="file renaming" style="--level: {node.level};">
    {@render icon()}
    <input
      bind:this={inputElement}
      bind:value={draft}
      class="rename-input"
      onkeydown={handleInputKeydown}
      onblur={commit}
    />
  </div>
{:else}
  <button
    class="file"
    class:selected
    class:folder={node.is_folder}
    class:drop-target={dropTarget}
    class:dragged
    style="--level: {node.level};"
    draggable={$canWrite}
    onclick={handleClick}
    ondblclick={() => startRenaming(node.id)}
    oncontextmenu={handleContextMenu}
    onkeydown={handleKeydown}
    ondragstart={handleDragStart}
    ondragend={handleDragEnd}
    ondragenter={handleDragEnter}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
  >
    {@render icon()}
    <span class="file-name">{node.name}</span>
    {#if isMainFile}
      <span class="main-badge" title="Main file — this is what gets compiled">
        <Star size={13} />
      </span>
    {/if}
  </button>
{/if}

<style>
  .file {
    border: 1px transparent solid;
    border-bottom: 3px solid transparent;
    margin: 0 1rem;
    padding: 0.3rem 1rem;
    padding-left: calc(1rem + var(--level) * 0.85rem);
    border-radius: 6px;
    background-color: transparent;
    justify-content: flex-start;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    box-sizing: border-box;
    text-align: left;
  }

  .file :global(svg) {
    color: var(--text-tertiary);
    flex-shrink: 0;
  }

  .file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .main-badge {
    display: flex;
    align-items: center;
    margin-left: auto;
  }

  .chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 0.9rem;
    flex-shrink: 0;
    transition: transform 0.15s ease-out;
  }

  .chevron.expanded {
    transform: rotate(90deg);
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

  .file.folder:active .chevron :global(svg) {
    transform: none;
  }

  .file.drop-target {
    border: 1px dashed var(--navbar-border);
    background-color: var(--navbar-bg);
  }

  .file.dragged {
    opacity: 0.45;
  }

  .file.renaming {
    border: 1px solid var(--navbar-border);
    border-bottom: 3px solid var(--navbar-border);
    background-color: var(--navbar-bg);
  }

  .rename-input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font: inherit;
    font-weight: 600;
    padding: 0;
    outline: none;
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

  /* Last, so it wins over `.file.selected :global(svg)` above. */
  .main-badge :global(svg) {
    color: var(--color-warning);
    fill: currentColor;
    stroke-width: 2;
  }
</style>
