<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import FileTreeItem from "./FileTreeItem.svelte";
  import { IconButton, Tooltip, RightClickMenu } from "$lib/components/ui";
  import type { RightClickMenuItem } from "$lib/components/ui/RightClickMenu.svelte";
  import FilePlus from "@lucide/svelte/icons/file-plus";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import Folder from "@lucide/svelte/icons/folder";
  import File from "@lucide/svelte/icons/file";
  import ArrowUpFromLine from "@lucide/svelte/icons/arrow-up-from-line";
  import PencilLine from "@lucide/svelte/icons/pencil-line";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import type { File as ProjectFile, Asset, FileTreeNode } from "$lib/types";
  import type { WebsocketProvider } from "y-websocket";
  import { buildFileTree, flattenTree } from "$lib/utils/fileTree";

  interface Props {
    files: ProjectFile[];
    assets: Asset[];
    selectedItem: ProjectFile | Asset | null;
    previewFileId?: number | null;
    onSelectFile: (file: ProjectFile) => void;
    onSelectAsset: (asset: Asset) => void;
    onSetPreviewFile: (fileId: number) => void;
    onRenameFile?: ((fileId: number, newName: string) => void) | null;
    onRenameAsset?: ((assetId: number, newName: string) => void) | null;
    onMoveFile?:
      | ((fileId: number, targetFolderId: number | null) => void)
      | null;
    onMoveAsset?:
      | ((assetId: number, targetFolderId: number | null) => void)
      | null;
    onDeleteFile?: ((fileId: number) => void) | null;
    onDeleteAsset?: ((assetId: number) => void) | null;
    onCreateFile?: ((fileName: string, parentId: number | null) => void) | null;
    onCreateFolder?:
      | ((folderName: string, parentId: number | null) => void)
      | null;
    onUploadAsset?: (() => void) | null;
    onClearSelection?: (() => void) | null;
    provider?: WebsocketProvider | null;
  }

  let {
    files,
    assets,
    selectedItem,
    previewFileId = null,
    onSelectFile,
    onSelectAsset,
    onSetPreviewFile,
    onRenameFile = null,
    onRenameAsset = null,
    onMoveFile = null,
    onMoveAsset = null,
    onDeleteFile = null,
    onDeleteAsset = null,
    onCreateFile = null,
    onCreateFolder = null,
    onUploadAsset = null,
    onClearSelection = null,
    provider = null,
  }: Props = $props();

  let awarenessStates: [number, any][] = [];

  // Track expanded folders - stores folder IDs that are expanded
  let expandedFolders = $state(new Set<number>());

  // Track the last clicked item for delete operations
  let lastClickedItem = $state<TreeItem | null>(null);

  // Track the last expanded folder for creation context
  let lastExpandedFolderId = $state<number | null>(null);

  // State for inline file/folder creation
  let creatingItem = $state<{
    type: "file" | "folder";
    parentId: number | null;
    name: string;
  } | null>(null);
  let creatingInputElement = $state<HTMLInputElement | undefined>();

  // Auto-focus the creating input when it appears
  $effect(() => {
    if (creatingItem && creatingInputElement) {
      creatingInputElement.focus();
    }
  });

  // State for right-click menu
  let showRightClickMenu = $state(false);
  let rightClickMenuX = $state(0);
  let rightClickMenuY = $state(0);
  let rightClickMenuItems = $state<RightClickMenuItem[]>([]);

  // State for drag and drop with overlay
  let draggedItem = $state<{
    id: number;
    isAsset: boolean;
    isFolder: boolean;
  } | null>(null);
  let dropZone = $state<{
    top: number;
    height: number;
    targetId: number | null;
  } | null>(null);
  let treeContentElement = $state<HTMLDivElement | undefined>();

  function updateAwareness() {
    if (provider?.awareness) {
      awarenessStates = Array.from(provider.awareness.getStates().entries());
    } else {
      awarenessStates = [];
    }
  }

  $effect(() => {
    if (provider) {
      updateAwareness();
    }
  });

  function handleTriggerRename() {
    // Find the selected item and trigger its rename
    const selectedElement = document.querySelector(".file-item.active");
    if (selectedElement) {
      // Trigger double-click event on the selected element
      const dblClickEvent = new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      selectedElement.dispatchEvent(dblClickEvent);
    }
  }

  onMount(() => {
    if (provider?.awareness) {
      provider.awareness.on("change", updateAwareness);
      updateAwareness();
    }

    // Listen for rename trigger events
    window.addEventListener("trigger-file-rename", handleTriggerRename);
    window.addEventListener("trigger-new-file", () =>
      startInlineCreate("file"),
    );
    window.addEventListener("trigger-new-folder", () =>
      startInlineCreate("folder"),
    );
  });

  onDestroy(() => {
    if (provider?.awareness) {
      provider.awareness.off("change", updateAwareness);
    }
    window.removeEventListener("trigger-file-rename", handleTriggerRename);
    window.removeEventListener("trigger-new-file", () =>
      startInlineCreate("file"),
    );
    window.removeEventListener("trigger-new-folder", () =>
      startInlineCreate("folder"),
    );
  });

  type TreeItem = (FileTreeNode | Asset) & { isAsset?: boolean };

  // Type guard for creating items
  function isCreatingItem(
    item: any,
  ): item is { isCreating: true; is_folder: boolean; level: number } {
    return item.isCreating === true;
  }

  // Type guard to check if item is a folder (not an asset)
  function isFolder(item: TreeItem): item is FileTreeNode {
    return !item.isAsset && "is_folder" in item && item.is_folder === true;
  }

  // Build hierarchical file tree and integrate assets
  let fileTree = $derived(buildFileTree(files));

  // Insert assets into the tree structure based on their parent_id
  let fileTreeWithAssets = $derived(
    (() => {
      const tree = JSON.parse(JSON.stringify(fileTree)) as FileTreeNode[]; // Deep clone
      const fileMap = new Map<number, FileTreeNode>();

      // Build a map of all nodes for quick lookup
      const buildMap = (nodes: FileTreeNode[]) => {
        for (const node of nodes) {
          fileMap.set(node.id, node);
          if (node.children) {
            buildMap(node.children);
          }
        }
      };
      buildMap(tree);

      // Add assets to their parent folders or root
      for (const asset of assets) {
        const assetNode = {
          ...asset,
          name: asset.filename,
          path: asset.path || "",
          type: "other" as const,
          content: "",
          is_folder: false,
          isAsset: true,
          children: [],
          level: 0,
          isExpanded: false,
        };

        if (asset.parent_id === null) {
          // Root level asset
          tree.push(assetNode as any);
        } else {
          // Find parent and add as child
          const parent = fileMap.get(asset.parent_id);
          if (parent) {
            parent.children.push(assetNode as any);
            assetNode.level = parent.level + 1;
          } else {
            // Parent not found, add to root
            tree.push(assetNode as any);
          }
        }
      }

      // Sort each level: folders first, then files/assets alphabetically
      const sortNodes = (nodes: any[]) => {
        nodes.sort((a, b) => {
          if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1;
          const nameA = "filename" in a ? a.filename : a.name;
          const nameB = "filename" in b ? b.filename : b.name;
          return nameA.localeCompare(nameB);
        });
        nodes.forEach((n) => {
          if (n.children) sortNodes(n.children);
        });
      };
      sortNodes(tree);

      return tree;
    })(),
  );

  // Flatten tree for rendering, respecting collapsed state
  let allItems = $derived(
    flattenTree(fileTreeWithAssets, expandedFolders).map((item) => ({
      ...item,
      isAsset: "mime_type" in item,
    })),
  );

  // Insert creating item at appropriate position if active
  let itemsToRender = $derived(
    (() => {
      if (!creatingItem) return allItems;

      const { type, parentId } = creatingItem;

      // Create a temporary item for rendering
      const tempItem = {
        id: -1, // Temporary ID
        name: "",
        path: "",
        type: "other" as const,
        content: "",
        is_folder: type === "folder",
        isAsset: false,
        parent_id: parentId,
        level: 0,
        isExpanded: false,
        children: [],
        project_id: 0,
        created_at: "",
        updated_at: "",
        isCreating: true, // Special flag
      } as any;

      // Find insertion index
      let insertIndex = 0;
      if (parentId === null) {
        // Insert at root
        tempItem.level = 0;
        const rootItems = allItems.filter((item) => item.parent_id === null);

        if (type === "folder") {
          // Insert folder at end of folders (before first file)
          const firstFileIndex = allItems.findIndex(
            (item) => !item.is_folder && item.parent_id === null,
          );
          insertIndex =
            firstFileIndex === -1 ? rootItems.length : firstFileIndex;
        } else {
          // Insert file at end of root items
          insertIndex = rootItems.length;
        }
      } else {
        // Find parent and insert within that folder's children
        const parentIndex = allItems.findIndex(
          (item) => item.id === parentId && !item.isAsset,
        );
        if (parentIndex !== -1) {
          const parent = allItems[parentIndex];
          tempItem.level = parent.level + 1;

          // Find all children of this parent
          let lastChildIndex = parentIndex;
          for (let i = parentIndex + 1; i < allItems.length; i++) {
            if (allItems[i].level <= parent.level) break;
            if (
              allItems[i].parent_id === parentId &&
              allItems[i].level === tempItem.level
            ) {
              lastChildIndex = i;
              if (type === "folder" && !allItems[i].is_folder) {
                // If creating folder and found first file, insert before it
                insertIndex = i;
                break;
              }
            }
          }

          if (insertIndex === 0) {
            // No specific position found, insert after last child
            insertIndex = lastChildIndex + 1;
          }
        }
      }

      const result = [...allItems];
      result.splice(insertIndex, 0, tempItem as any);
      return result;
    })(),
  );

  // Make the selection map reactive
  let selectedId = $derived(selectedItem?.id);
  let selectedIsAsset = $derived(
    selectedItem ? "filename" in selectedItem : false,
  );

  // Create a reactive map of which items are selected and which users are viewing them
  // Filter out creating items to prevent preview issues
  let itemsWithSelection = $derived(
    itemsToRender
      .filter((item) => !isCreatingItem(item))
      .map((item) => {
        const isSelected = selectedId
          ? item.id === selectedId && item.isAsset === selectedIsAsset
          : false;

        // Find users viewing this item (file or asset, excluding the local user)
        const usersViewing = awarenessStates
          .filter(([clientId, state]) => {
            // Exclude local user and check if they're viewing this item
            return (
              state.user?.name &&
              clientId !== provider?.awareness?.clientID &&
              state.currentItem?.id === item.id &&
              state.currentItem?.isAsset === item.isAsset
            );
          })
          .map(([_, state]) => ({
            name: state.user?.name,
            color: state.user?.color || "#999",
          }));

        return {
          item,
          isSelected,
          usersViewing,
        };
      }),
  );

  function handleSelect(item: TreeItem) {
    lastClickedItem = item;

    // Only change editor selection for files and assets, not folders
    if (isFolder(item)) {
      return;
    }

    if (item.isAsset) {
      onSelectAsset(item as Asset);
    } else {
      onSelectFile(item as unknown as ProjectFile);
    }
  }

  async function handleRename(item: TreeItem, newName: string) {
    if (item.isAsset && onRenameAsset) {
      await onRenameAsset(item.id, newName);
    } else if (!item.isAsset && onRenameFile) {
      await onRenameFile(item.id, newName);
    }
  }

  async function handleDelete(item: TreeItem) {
    if (item.isAsset && onDeleteAsset) {
      await onDeleteAsset(item.id);
    } else if (!item.isAsset && onDeleteFile) {
      await onDeleteFile(item.id);
    }
  }

  function handleToggleFolder(folderId: number) {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      // Collapsing folder - clear last expanded folder if it's this one
      newExpanded.delete(folderId);
      if (lastExpandedFolderId === folderId) {
        lastExpandedFolderId = null;
      }
    } else {
      // Expanding folder - track it as last expanded
      newExpanded.add(folderId);
      lastExpandedFolderId = folderId;
    }
    expandedFolders = newExpanded;
  }

  function handleTreeContentClick(e: MouseEvent) {
    // Reset last clicked item and last expanded folder when clicking on empty space
    // But don't change the current selection/display
    if (e.target === e.currentTarget) {
      lastClickedItem = null;
      lastExpandedFolderId = null;
    }
  }

  function handleTreeContentContextMenu(e: MouseEvent) {
    // Right-click on background - show New File/Folder options
    if (e.target === e.currentTarget) {
      e.preventDefault();
      rightClickMenuX = e.clientX;
      rightClickMenuY = e.clientY;
      rightClickMenuItems = [
        {
          label: "New File",
          icon: FilePlus,
          onclick: () => startInlineCreate("file"),
        },
        {
          label: "New Folder",
          icon: FolderPlus,
          onclick: () => startInlineCreate("folder"),
        },
      ];
      showRightClickMenu = true;
    }
  }

  function handleTreeKeyDown(e: KeyboardEvent) {
    // Handle Delete/Backspace key to delete last clicked item
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      lastClickedItem &&
      !creatingItem
    ) {
      e.preventDefault();
      handleDelete(lastClickedItem);
    }
  }

  // Calculate drop zone based on mouse position and hovered item
  function calculateDropZone(
    e: DragEvent,
  ): { top: number; height: number; targetId: number | null } | null {
    if (!treeContentElement) return null;

    const treeRect = treeContentElement.getBoundingClientRect();
    const target = e.target as HTMLElement;

    // Find the item element (with data-item-id)
    let itemElement = target.closest("[data-item-id]") as HTMLElement | null;

    if (!itemElement) {
      // Dragging over background - drop to root
      const firstItem = treeContentElement.querySelector(
        '[role="treeitem"]',
      ) as HTMLElement | null;
      const lastItem = Array.from(
        treeContentElement.querySelectorAll('[role="treeitem"]'),
      ).pop() as HTMLElement | null;

      if (firstItem && lastItem) {
        const firstRect = firstItem.getBoundingClientRect();
        const lastRect = lastItem.getBoundingClientRect();
        return {
          top: firstRect.top - treeRect.top,
          height: lastRect.bottom - firstRect.top,
          targetId: null,
        };
      } else {
        // No items - highlight entire tree content
        return {
          top: 0,
          height: treeRect.height,
          targetId: null,
        };
      }
    }

    const itemId = parseInt(itemElement.getAttribute("data-item-id") || "0");
    const item = allItems.find((i) => i.id === itemId && !isCreatingItem(i)) as
      | TreeItem
      | undefined;

    if (!item) return null;

    // Check if this is a folder
    if (isFolder(item)) {
      const isExpanded = expandedFolders.has(item.id);
      const itemRect = itemElement.getBoundingClientRect();

      if (isExpanded) {
        // Expanded folder - highlight folder + all its children
        // Find all children at any depth
        let lastChildElement = itemElement;
        const children = Array.from(
          treeContentElement.querySelectorAll('[role="treeitem"]'),
        ) as HTMLElement[];
        const itemIndex = children.indexOf(itemElement);

        for (let i = itemIndex + 1; i < children.length; i++) {
          const childId = parseInt(
            children[i].getAttribute("data-item-id") || "0",
          );
          const childItem = allItems.find(
            (c) => c.id === childId && !isCreatingItem(c),
          ) as TreeItem | undefined;

          if (!childItem || !("parent_id" in childItem)) break;

          // Check if this child belongs to our folder (directly or indirectly)
          let parentId = childItem.parent_id;
          let belongsToFolder = false;

          while (parentId !== null) {
            if (parentId === item.id) {
              belongsToFolder = true;
              break;
            }
            const parent = allItems.find(
              (p) => p.id === parentId && !isCreatingItem(p) && !p.isAsset,
            ) as TreeItem | undefined;
            if (!parent || !("parent_id" in parent)) break;
            parentId = parent.parent_id;
          }

          if (belongsToFolder) {
            lastChildElement = children[i];
          } else {
            break;
          }
        }

        const lastRect = lastChildElement.getBoundingClientRect();
        return {
          top: itemRect.top - treeRect.top,
          height: lastRect.bottom - itemRect.top,
          targetId: item.id,
        };
      } else {
        // Collapsed folder - just highlight the folder item
        return {
          top: itemRect.top - treeRect.top,
          height: itemRect.height,
          targetId: item.id,
        };
      }
    }

    // File or asset - drop will use its parent (same level as this item)
    // Determine parent
    const parentId = "parent_id" in item ? item.parent_id : null;

    if (parentId === null) {
      // Root level file/asset - highlight all root items (like background hover)
      const firstItem = treeContentElement.querySelector(
        '[role="treeitem"]',
      ) as HTMLElement | null;
      const lastItem = Array.from(
        treeContentElement.querySelectorAll('[role="treeitem"]'),
      ).pop() as HTMLElement | null;

      if (firstItem && lastItem) {
        const firstRect = firstItem.getBoundingClientRect();
        const lastRect = lastItem.getBoundingClientRect();
        return {
          top: firstRect.top - treeRect.top,
          height: lastRect.bottom - firstRect.top,
          targetId: null,
        };
      } else {
        return {
          top: 0,
          height: treeRect.height,
          targetId: null,
        };
      }
    } else {
      // File/asset inside a folder - highlight parent folder + all its content
      const parent = allItems.find(
        (p) => p.id === parentId && !isCreatingItem(p) && !p.isAsset,
      ) as TreeItem | undefined;

      if (!parent || !isFolder(parent)) {
        // Fallback - just highlight this item
        const itemRect = itemElement.getBoundingClientRect();
        return {
          top: itemRect.top - treeRect.top,
          height: itemRect.height,
          targetId: parentId,
        };
      }

      // Find parent element and highlight it + children (like hovering the folder)
      const children = Array.from(
        treeContentElement.querySelectorAll('[role="treeitem"]'),
      ) as HTMLElement[];
      const parentElement = children.find((el) => {
        const id = parseInt(el.getAttribute("data-item-id") || "0");
        return id === parentId;
      });

      if (!parentElement) {
        // Fallback
        const itemRect = itemElement.getBoundingClientRect();
        return {
          top: itemRect.top - treeRect.top,
          height: itemRect.height,
          targetId: parentId,
        };
      }

      const parentRect = parentElement.getBoundingClientRect();
      const isExpanded = expandedFolders.has(parentId);

      if (isExpanded) {
        // Find all children of parent folder
        let lastChildElement = parentElement;
        const parentIndex = children.indexOf(parentElement);

        for (let i = parentIndex + 1; i < children.length; i++) {
          const childId = parseInt(
            children[i].getAttribute("data-item-id") || "0",
          );
          const childItem = allItems.find(
            (c) => c.id === childId && !isCreatingItem(c),
          ) as TreeItem | undefined;

          if (!childItem || !("parent_id" in childItem)) break;

          // Check if this child belongs to our folder (directly or indirectly)
          let checkParentId = childItem.parent_id;
          let belongsToFolder = false;

          while (checkParentId !== null) {
            if (checkParentId === parentId) {
              belongsToFolder = true;
              break;
            }
            const parentOfChild = allItems.find(
              (p) => p.id === checkParentId && !isCreatingItem(p) && !p.isAsset,
            ) as TreeItem | undefined;
            if (!parentOfChild || !("parent_id" in parentOfChild)) break;
            checkParentId = parentOfChild.parent_id;
          }

          if (belongsToFolder) {
            lastChildElement = children[i];
          } else {
            break;
          }
        }

        const lastRect = lastChildElement.getBoundingClientRect();
        return {
          top: parentRect.top - treeRect.top,
          height: lastRect.bottom - parentRect.top,
          targetId: parentId,
        };
      } else {
        // Collapsed folder - just highlight the parent folder item
        return {
          top: parentRect.top - treeRect.top,
          height: parentRect.height,
          targetId: parentId,
        };
      }
    }
  }

  function handleTreeDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    dropZone = calculateDropZone(e);
  }

  function handleTreeDragLeave(e: DragEvent) {
    // Only clear if leaving the tree-content element itself
    if (e.currentTarget === e.target) {
      dropZone = null;
    }
  }

  function handleTreeDrop(e: DragEvent) {
    e.preventDefault();

    if (!draggedItem || !e.dataTransfer) {
      dropZone = null;
      draggedItem = null;
      return;
    }

    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));

      // Calculate final target
      const zone = calculateDropZone(e);
      const targetParentId = zone?.targetId ?? null;

      // Don't allow dropping onto self
      if (data.id === targetParentId && !data.isAsset) {
        dropZone = null;
        draggedItem = null;
        return;
      }

      // Move the item
      if (data.isAsset) {
        if (onMoveAsset) {
          onMoveAsset(data.id, targetParentId);
        }
      } else {
        if (onMoveFile) {
          onMoveFile(data.id, targetParentId);
        }
      }
    } catch (error) {
      console.error("Failed to parse drag data:", error);
    }

    dropZone = null;
    draggedItem = null;
  }

  function handleItemDragStart(
    itemId: number,
    isAsset: boolean,
    isFolder: boolean,
  ) {
    draggedItem = { id: itemId, isAsset, isFolder };
  }

  function handleItemDragEnd() {
    draggedItem = null;
    dropZone = null;
  }

  function handleItemContextMenu(e: MouseEvent, item: TreeItem) {
    e.preventDefault();
    e.stopPropagation();
    rightClickMenuX = e.clientX;
    rightClickMenuY = e.clientY;

    const menuItems: RightClickMenuItem[] = [];

    // Add New File/Folder options for folders
    if (isFolder(item) && (onCreateFile || onCreateFolder)) {
      if (onCreateFile) {
        menuItems.push({
          label: "New File",
          icon: FilePlus,
          onclick: () => startInlineCreate("file", item.id),
        });
      }
      if (onCreateFolder) {
        menuItems.push({
          label: "New Folder",
          icon: FolderPlus,
          onclick: () => startInlineCreate("folder", item.id),
        });
      }
      // Add separator after New File/Folder options
      if (menuItems.length > 0) {
        menuItems[menuItems.length - 1].separator = true;
      }
    }

    // Add Rename option
    if (onRenameFile || onRenameAsset) {
      menuItems.push({
        label: "Rename",
        icon: PencilLine,
        onclick: () => {
          // Select the item first
          handleSelect(item);
          // Trigger rename for this item
          setTimeout(() => {
            const itemElement = document.querySelector(
              `[data-item-id="${item.id}"]`,
            );
            if (itemElement) {
              // Find the FileTreeItem within and dispatch dblclick
              const fileItem = itemElement.querySelector(".file-item");
              if (fileItem) {
                const dblClickEvent = new MouseEvent("dblclick", {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                });
                fileItem.dispatchEvent(dblClickEvent);
              }
            }
          }, 50);
        },
      });
    }

    // Add Delete option
    if (onDeleteFile || onDeleteAsset) {
      menuItems.push({
        label: "Delete",
        icon: Trash2,
        onclick: () => handleDelete(item),
      });
    }

    rightClickMenuItems = menuItems;
    showRightClickMenu = true;
  }

  function startInlineCreate(
    type: "file" | "folder",
    explicitParentId?: number | null,
  ) {
    // Determine parent based on:
    // 1. Explicit parent ID (from right-click menu)
    // 2. Last expanded folder
    // 3. Root level (default)
    let parentId: number | null = null;

    if (explicitParentId !== undefined) {
      // Explicitly set parent (e.g., from right-click menu)
      parentId = explicitParentId;
      // Ensure folder is expanded
      if (parentId !== null) {
        const newExpanded = new Set(expandedFolders);
        newExpanded.add(parentId);
        expandedFolders = newExpanded;
      }
    } else if (lastExpandedFolderId !== null) {
      // Last action was expanding a folder, create inside it
      parentId = lastExpandedFolderId;
    }
    // Otherwise parentId stays null (root level)

    creatingItem = { type, parentId, name: "" };
  }

  function cancelInlineCreate() {
    creatingItem = null;
  }

  async function submitInlineCreate(name: string) {
    if (!creatingItem || !name.trim()) {
      cancelInlineCreate();
      return;
    }

    let trimmedName = name.trim();
    const { type, parentId } = creatingItem;

    // Add .typ extension to files without an extension
    if (type === "file") {
      const hasExtension =
        trimmedName.includes(".") && trimmedName.lastIndexOf(".") > 0;
      if (!hasExtension) {
        trimmedName = trimmedName + ".typ";
      }
    }

    try {
      if (type === "file" && onCreateFile) {
        await onCreateFile(trimmedName, parentId);
        creatingItem = null;
      } else if (type === "folder" && onCreateFolder) {
        await onCreateFolder(trimmedName, parentId);
        creatingItem = null;
      }
    } catch (error) {
      // Error is already shown by parent component
      // Keep the input open so user can fix the name
      console.error("Failed to create item:", error);
    }
  }
</script>

<div class="file-tree">
  <div class="tree-header">
    <h3>Files</h3>
    <div class="actions">
      {#if onCreateFile}
        <Tooltip text="New file" position="bottom">
          <IconButton
            class="new-file-btn"
            icon={FilePlus}
            onclick={() => startInlineCreate("file")}
            size="sm"
            variant="ghost"
          />
        </Tooltip>
      {/if}
      {#if onCreateFolder}
        <Tooltip text="New folder" position="bottom">
          <IconButton
            icon={FolderPlus}
            onclick={() => startInlineCreate("folder")}
            size="sm"
            variant="ghost"
          />
        </Tooltip>
      {/if}
      {#if onUploadAsset}
        <Tooltip text="Upload asset" position="bottom">
          <IconButton
            class="upload-btn"
            icon={ArrowUpFromLine}
            onclick={onUploadAsset}
            size="sm"
            variant="ghost"
          />
        </Tooltip>
      {/if}
    </div>
  </div>

  <div
    bind:this={treeContentElement}
    class="tree-content"
    ondragover={handleTreeDragOver}
    ondragleave={handleTreeDragLeave}
    ondrop={handleTreeDrop}
    onclick={handleTreeContentClick}
    oncontextmenu={handleTreeContentContextMenu}
    onkeydown={handleTreeKeyDown}
    role="tree"
    tabindex="0"
  >
    {#if itemsToRender.length === 0 && !creatingItem}
      <div class="empty">No files or assets yet</div>
    {:else}
      {#each itemsToRender as item (`${isCreatingItem(item) ? "creating" : item.isAsset ? "asset" : "file"}-${item.id}`)}
        {#if isCreatingItem(item)}
          <!-- Render creating item with inline input -->
          <div
            class="file-item creating"
            style="padding-left: {item.level * 1.5 + 0.5}rem"
          >
            {#if item.is_folder}
              <span class="icon">
                <Folder size={16} />
              </span>
            {:else}
              <span class="icon">
                <File size={16} />
              </span>
            {/if}
            <input
              type="text"
              class="name-input"
              bind:this={creatingInputElement}
              bind:value={creatingItem!.name}
              onkeydown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitInlineCreate(creatingItem?.name || "");
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelInlineCreate();
                }
              }}
              onblur={() => {
                // Small delay to allow click events to fire
                setTimeout(() => cancelInlineCreate(), 100);
              }}
            />
          </div>
        {:else}
          {@const itemWithSelection = itemsWithSelection.find(
            (i) => i.item.id === item.id && i.item.isAsset === item.isAsset,
          )}
          {#if itemWithSelection}
            <div
              oncontextmenu={(e) => handleItemContextMenu(e, item)}
              data-item-id={item.id}
              role="treeitem"
              tabindex="0"
              aria-selected={selectedItem?.id === item.id &&
                item.isAsset === (selectedItem as any).isAsset}
            >
              <FileTreeItem
                item={itemWithSelection.item}
                isSelected={itemWithSelection.isSelected}
                usersViewing={itemWithSelection.usersViewing}
                isPreview={!item.isAsset && previewFileId === item.id}
                onSelect={() => handleSelect(item)}
                onSetPreview={!item.isAsset && !item.is_folder
                  ? () => onSetPreviewFile(item.id)
                  : undefined}
                onRename={onRenameFile || onRenameAsset
                  ? (newName) => handleRename(item, newName)
                  : null}
                onToggleFolder={!item.isAsset && item.is_folder
                  ? () => handleToggleFolder(item.id)
                  : undefined}
                onDragStart={() =>
                  handleItemDragStart(
                    item.id,
                    item.isAsset ?? false,
                    isFolder(item),
                  )}
                onDragEnd={handleItemDragEnd}
              />
            </div>
          {/if}
        {/if}
      {/each}
    {/if}

    <!-- Drop zone overlay -->
    {#if dropZone}
      <div
        class="drop-zone-overlay"
        style="top: {dropZone.top}px; height: {dropZone.height}px;"
      ></div>
    {/if}
  </div>
</div>

<RightClickMenu
  bind:show={showRightClickMenu}
  x={rightClickMenuX}
  y={rightClickMenuY}
  items={rightClickMenuItems}
  onClose={() => (showRightClickMenu = false)}
/>

<style>
  .file-tree {
    width: 100%;
    height: 100%;
    background: var(--bg-file-panel);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 8px;
    margin: 0 0 var(--space-3) 0;
    padding-right: 0;
  }

  .tree-header {
    padding: var(--space-4);
    padding-right: var(--space-4);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h3 {
    margin: 0;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }

  :global(.new-file-btn):hover {
    color: var(--color-tertiary-500) !important;
  }

  :global(.upload-btn):hover {
    color: var(--color-secondary-500) !important;
  }

  .tree-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
  }

  .empty {
    padding: var(--space-8) var(--space-4);
    text-align: center;
    color: var(--text-tertiary);
    font-size: var(--text-sm);
  }

  .file-item.creating {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-top: var(--space-2);
    padding-bottom: var(--space-2);
    cursor: default;
  }

  .file-item.creating .icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    color: inherit;
  }

  .file-item.creating .name-input {
    flex: 1;
    min-width: 0;
    max-width: 100%;
    background: var(--surface-hover);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    margin: 0 8px 0 0;
  }

  .file-item.creating .name-input:focus {
    border-color: var(--color-primary-500);
    outline: 2px solid var(--color-primary-500);
    outline-offset: 0px;
  }

  .drop-zone-overlay {
    position: absolute;
    left: 0;
    right: 0;
    pointer-events: none;
    z-index: 100;
    box-shadow: inset 0 0 0 2px var(--color-primary-500);
    background: rgba(59, 130, 246, 0.1);
    border-radius: 8px;
  }
</style>
