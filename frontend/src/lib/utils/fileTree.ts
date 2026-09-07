import type { File, FileTreeNode } from '$lib/types'

/** Build a hierarchical file tree from a flat array of files. */
export function buildFileTree(files: File[]): FileTreeNode[] {
  const fileMap = new Map<string, FileTreeNode>()

  files.forEach((f) => {
    fileMap.set(f.id, {
      ...f,
      children: [],
      level: 0,
      isExpanded: false,
    })
  })

  const roots: FileTreeNode[] = []

  files.forEach((file) => {
    const node = fileMap.get(file.id)!

    if (file.parent_id === null) {
      roots.push(node)
    } else {
      const parent = fileMap.get(file.parent_id)
      if (parent) {
        parent.children.push(node)
        node.level = parent.level + 1
      } else {
        // Orphan: treat as root.
        roots.push(node)
      }
    }
  })

  // Folders first, then alphabetically.
  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.is_folder !== b.is_folder) {
        return a.is_folder ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
    nodes.forEach((n) => sortNodes(n.children))
  }

  sortNodes(roots)

  return roots
}

/** Flatten the tree for rendering, dropping collapsed folders' children. */
export function flattenTree(
  nodes: FileTreeNode[],
  expandedFolders?: Set<string>
): FileTreeNode[] {
  const result: FileTreeNode[] = []

  for (const node of nodes) {
    const nodeWithExpanded = {
      ...node,
      isExpanded: expandedFolders ? expandedFolders.has(node.id) : node.isExpanded,
    }
    result.push(nodeWithExpanded)

    if (node.is_folder && (expandedFolders ? expandedFolders.has(node.id) : node.isExpanded)) {
      result.push(...flattenTree(node.children, expandedFolders))
    }
  }

  return result
}

/** Find a node in the tree by id. */
export function findNodeById(nodes: FileTreeNode[], fileId: string): FileTreeNode | null {
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

/** Ancestor ids of a file, from root to parent (used to expand its folders). */
export function getAncestorIds(files: File[], fileId: string): string[] {
  const ancestorIds: string[] = []
  let current = files.find((f) => f.id === fileId)

  while (current && current.parent_id !== null) {
    ancestorIds.unshift(current.parent_id)
    current = files.find((f) => f.id === current!.parent_id)
  }

  return ancestorIds
}
