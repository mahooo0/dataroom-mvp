import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { FileText, Folder as FolderIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { type ReactNode, useState } from 'react'
import { useMoveFile } from '@/features/move-file'
import { useMoveFolder } from '@/features/move-folder'

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

interface DragDropRootProps {
  children: ReactNode
}

export function DragDropRoot({ children }: DragDropRootProps) {
  const moveFile = useMoveFile()
  const moveFolder = useMoveFolder()

  const [active, setActive] = useState<DragData | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  const onDragStart = (e: DragStartEvent) => {
    setActive((e.active.data.current as DragData | undefined) ?? null)
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null)
    const dragged = e.active.data.current as DragData | undefined
    const target = e.over?.data.current as DropData | undefined
    if (!dragged || !target) return

    if (dragged.kind === 'file' && target.kind === 'folder') {
      if (dragged.folderId === target.folderId) return
      moveFile.mutate({
        id: dragged.id,
        fromFolderId: dragged.folderId,
        toFolderId: target.folderId,
        name: dragged.name,
      })
      return
    }

    if (dragged.kind === 'folder') {
      if (dragged.dataroomId !== target.dataroomId) return
      const toParentId = target.kind === 'root' ? null : target.folderId
      if (toParentId === dragged.id) return
      if (dragged.parentId === toParentId) return
      moveFolder.mutate({
        id: dragged.id,
        dataroomId: dragged.dataroomId,
        fromParentId: dragged.parentId,
        toParentId,
        name: dragged.name,
      })
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {children}
      <DragOverlay dropAnimation={null}>
        {active ? <DragPreview data={active} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function DragPreview({ data }: { data: DragData }) {
  const Icon = data.kind === 'file' ? FileText : FolderIcon
  return (
    <motion.div
      initial={{ rotate: 0, scale: 0.95 }}
      animate={{ rotate: 4, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className="pointer-events-none flex origin-center items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-xl ring-1 ring-black/5"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="max-w-[180px] truncate font-medium">{data.name}</span>
    </motion.div>
  )
}
