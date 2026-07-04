export interface FileDragData {
  kind: 'file'
  id: string
  name: string
  folderId: string
}

export interface FolderDragData {
  kind: 'folder'
  id: string
  name: string
  dataroomId: string
  parentId: string | null
}

export type DragData = FileDragData | FolderDragData

export interface FolderDropData {
  kind: 'folder'
  folderId: string
  dataroomId: string
}

export interface RootDropData {
  kind: 'root'
  dataroomId: string
}

export type DropData = FolderDropData | RootDropData
