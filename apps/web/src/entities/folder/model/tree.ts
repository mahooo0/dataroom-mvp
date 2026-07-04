import type { Folder } from '@dataroom/shared'

export interface FolderNode {
  folder: Folder
  children: FolderNode[]
}

export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const nodeById = new Map<string, FolderNode>()
  for (const folder of folders) {
    nodeById.set(folder.id, { folder, children: [] })
  }
  const roots: FolderNode[] = []
  for (const node of nodeById.values()) {
    if (node.folder.parentId) {
      const parent = nodeById.get(node.folder.parentId)
      if (parent) parent.children.push(node)
      else roots.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortRec = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.folder.name.localeCompare(b.folder.name))
    for (const n of nodes) sortRec(n.children)
  }
  sortRec(roots)
  return roots
}

export function findBreadcrumb(folders: Folder[], folderId: string | null): Folder[] {
  if (!folderId) return []
  const byId = new Map(folders.map((f) => [f.id, f]))
  const trail: Folder[] = []
  let current = byId.get(folderId)
  while (current) {
    trail.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return trail
}

export function childrenOf(folders: Folder[], parentId: string | null): Folder[] {
  return folders.filter((f) => f.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name))
}
