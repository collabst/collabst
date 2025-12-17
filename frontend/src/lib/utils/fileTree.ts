import type { File, FileTreeNode } from '$lib/types'

/**
 * Build a hierarchical file tree from a flat array of files
 * @param files - Flat array of files
 * @returns Array of root-level tree nodes
 */
export function buildFileTree(files: File[]): FileTreeNode[] {
  // Build map: id -> tree node
  const fileMap = new Map<number, FileTreeNode>()

  files.forEach((f) => {
    fileMap.set(f.id, {
      ...f,
      children: [],
      level: 0,
      isExpanded: false,
    })
  })

  // Build parent-child relationships
  const roots: FileTreeNode[] = []

  files.forEach((file) => {
    const node = fileMap.get(file.id)!

    if (file.parent_id === null) {
      // Root level file/folder
      roots.push(node)
    } else {
      // Child file/folder
      const parent = fileMap.get(file.parent_id)
      if (parent) {
        parent.children.push(node)
        node.level = parent.level + 1
      } else {
        // Parent not found (shouldn't happen), treat as root
        roots.push(node)
      }
    }
  })

  // Sort nodes: folders first, then alphabetically
  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      // Folders come before files
      if (a.is_folder !== b.is_folder) {
        return a.is_folder ? -1 : 1
      }
      // Within same type, sort alphabetically
      return a.name.localeCompare(b.name)
    })
    // Recursively sort children
    nodes.forEach((n) => sortNodes(n.children))
  }

  sortNodes(roots)

  return roots
}

/**
 * Flatten tree for rendering, respecting collapsed state
 * @param nodes - Array of tree nodes
 * @param expandedFolders - Set of expanded folder IDs
 * @returns Flattened array of nodes to render
 */
export function flattenTree(
  nodes: FileTreeNode[],
  expandedFolders?: Set<number>
): FileTreeNode[] {
  const result: FileTreeNode[] = []

  for (const node of nodes) {
    // Add current node with expanded state
    const nodeWithExpanded = {
      ...node,
      isExpanded: expandedFolders ? expandedFolders.has(node.id) : node.isExpanded,
    }
    result.push(nodeWithExpanded)

    // If this is a folder and it's expanded, add its children recursively
    if (node.is_folder && (expandedFolders ? expandedFolders.has(node.id) : node.isExpanded)) {
      result.push(...flattenTree(node.children, expandedFolders))
    }
  }

  return result
}

/**
 * Find a node in the tree by ID
 * @param nodes - Array of tree nodes to search
 * @param fileId - File ID to find
 * @returns The found node or null
 */
export function findNodeById(nodes: FileTreeNode[], fileId: number): FileTreeNode | null {
  for (const node of nodes) {
    if (node.id === fileId) {
      return node
    }
    if (node.children.length > 0) {
      const found = findNodeById(node.children, fileId)
      if (found) return found
    }
  }
  return null
}

/**
 * Get all ancestor IDs of a file (for expanding parent folders)
 * @param files - Flat array of files
 * @param fileId - File ID to get ancestors for
 * @returns Array of ancestor IDs (from root to parent)
 */
export function getAncestorIds(files: File[], fileId: number): number[] {
  const ancestorIds: number[] = []
  let current = files.find((f) => f.id === fileId)

  while (current && current.parent_id !== null) {
    ancestorIds.unshift(current.parent_id)
    current = files.find((f) => f.id === current!.parent_id)
  }

  return ancestorIds
}
