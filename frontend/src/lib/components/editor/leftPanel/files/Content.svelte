<script lang="ts">
  import {
    canDropOnNode,
    canWrite,
    draggedNodeId,
    dropOnNode,
    openFileMenu,
    uploadAssetsNextTo,
    visibleTree,
  } from "$lib/components/editor/context";
  import Node from "./File.svelte";

  // `dragleave` fires every time the pointer crosses into a child, so the depth
  // is counted rather than treated as a single enter/leave pair.
  let dragDepth = $state(0);
  let dropKind: "upload" | "move" | null = $state(null);
  let dragging = $derived(dragDepth > 0 && dropKind !== null);

  // Right-clicking the empty space below the tree targets the project root.
  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    openFileMenu({ node: null, x: event.clientX, y: event.clientY });
  }

  // Anything a row did not claim ends up here, which is the project root: OS
  // files are uploaded there, a dragged row is moved there.
  function accepts(event: DragEvent): "upload" | "move" | null {
    if (!$canWrite) return null;
    if ($draggedNodeId !== null) {
      return canDropOnNode(null) ? "move" : null;
    }
    return Array.from(event.dataTransfer?.types ?? []).includes("Files")
      ? "upload"
      : null;
  }

  function handleDragEnter(event: DragEvent) {
    const kind = accepts(event);
    if (!kind) return;
    dropKind = kind;
    dragDepth += 1;
  }

  function handleDragOver(event: DragEvent) {
    const kind = accepts(event);
    if (!kind) return;
    // Without this the browser navigates to the dropped file.
    event.preventDefault();
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
    if (kind === "move") {
      dropOnNode(null);
      return;
    }
    const dropped = Array.from(event.dataTransfer?.files ?? []);
    if (dropped.length > 0) uploadAssetsNextTo(dropped, null);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="content"
  class:dragging
  oncontextmenu={handleContextMenu}
  ondragenter={handleDragEnter}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  {#each $visibleTree as node (node.id)}
    <Node {node} />
  {/each}
  {#if dragging}
    <div class="drop-hint">
      {dropKind === "move" ? "Drop to move to the root" : "Drop to upload"}
    </div>
  {/if}
</div>

<style>
  .content {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding: 3px 0 5rem;
  }

  .content.dragging {
    outline: 2px dashed var(--navbar-border);
    outline-offset: -0.75rem;
    border-radius: 1rem;
  }

  .drop-hint {
    position: sticky;
    bottom: 1rem;
    align-self: center;
    margin-top: auto;
    padding: 0.35rem 0.9rem;
    border-radius: 1rem;
    background-color: var(--navbar-bg);
    border: 1px solid var(--navbar-border);
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 600;
    pointer-events: none;
  }
</style>
