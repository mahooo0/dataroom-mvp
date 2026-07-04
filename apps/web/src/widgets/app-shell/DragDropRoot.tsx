import type { Folder } from '@dataroom/shared'
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useQueryClient } from '@tanstack/react-query'
import { FileText, Folder as FolderIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { type ReactNode, useState } from 'react'
import { folderKeys } from '@/entities/folder/model/keys'
import { useMoveFile } from '@/features/move-file'
import { useMoveFolder } from '@/features/move-folder'
import type { DragData, DropData } from '@/shared/dnd'

interface DragDropRootProps {
  children: ReactNode
}

export function DragDropRoot({ children }: DragDropRootProps) {
  const moveFile = useMoveFile()
  const moveFolder = useMoveFolder()

  const [active, setActive] = useState<DragData | null>(null)

  const queryClient = useQueryClient()

  const isDescendantOf = (candidateId: string, ancestorId: string, dataroomId: string): boolean => {
    if (candidateId === ancestorId) return true
    const folders = queryClient.getQueryData<Folder[]>(folderKeys.inDataroom(dataroomId))
    if (!folders) return false
    const byId = new Map(folders.map((f) => [f.id, f]))
    let current = byId.get(candidateId)
    while (current?.parentId) {
      if (current.parentId === ancestorId) return true
      current = byId.get(current.parentId)
    }
    return false
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
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
      if (toParentId && isDescendantOf(toParentId, dragged.id, dragged.dataroomId)) return
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
