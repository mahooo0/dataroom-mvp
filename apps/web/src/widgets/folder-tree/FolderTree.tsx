import type { Folder } from '@dataroom/shared'
import { ACCEPTED_MIME } from '@dataroom/shared'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  ChevronRight,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { buildFolderTree, type FolderNode } from '@/entities/folder'
import { useUploadFile } from '@/features/upload-file'
import { cn } from '@/shared/lib/utils'
import {
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from '@/shared/ui/animate-ui/components/radix/sidebar'
import { HighlightItem } from '@/shared/ui/animate-ui/primitives/effects/highlight'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/animate-ui/primitives/radix/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import type { FolderDragData, FolderDropData, RootDropData } from '@/widgets/app-shell/DragDropRoot'

// Same gradient the parent SidebarMenuButton uses for active state — matches
// the slide-highlight animation across sidebar rows.
const TREE_ROW_ACTIVE =
  'bg-[linear-gradient(to_bottom_right,rgba(137,190,255,0.22),rgba(137,190,255,0.85))] text-neutral-900 dark:text-neutral-50 rounded-md ring-1 ring-inset ring-[#89BEFF]/30'

interface FolderTreeProps {
  dataroomId: string
  folders: Folder[]
  selectedFolderId: string | null
  onSelect: (folderId: string | null) => void
  onCreateChild: (parentId: string | null) => void
  onRename: (folder: Folder) => void
  onDelete: (folder: Folder) => void
}

export function FolderTree({
  dataroomId,
  folders,
  selectedFolderId,
  onSelect,
  onCreateChild,
  onRename,
  onDelete,
}: FolderTreeProps) {
  const roots = buildFolderTree(folders)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const { enqueue } = useUploadFile()

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const openFilePicker = useCallback(
    (folderId: string) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.accept = ACCEPTED_MIME
      input.onchange = () => {
        if (input.files?.length) enqueue(Array.from(input.files), folderId)
      }
      input.click()
    },
    [enqueue],
  )

  return (
    <SidebarMenuSub>
      <SidebarMenuSubItem>
        <RootDropRow
          dataroomId={dataroomId}
          isActive={selectedFolderId === null}
          onSelect={() => onSelect(null)}
        />
        <SidebarMenuAction
          showOnHover
          onClick={() => onCreateChild(null)}
          aria-label="New folder in root"
          className="top-1.5"
        >
          <FolderPlus />
        </SidebarMenuAction>
      </SidebarMenuSubItem>

      {roots.map((node) => (
        <TreeNode
          key={node.folder.id}
          node={node}
          dataroomId={dataroomId}
          expanded={expanded}
          onToggle={toggle}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
          onRename={onRename}
          onDelete={onDelete}
          onUpload={openFilePicker}
        />
      ))}
    </SidebarMenuSub>
  )
}

function RootDropRow({
  dataroomId,
  isActive,
  onSelect,
}: {
  dataroomId: string
  isActive: boolean
  onSelect: () => void
}) {
  const dropData: RootDropData = { kind: 'root', dataroomId }
  const { setNodeRef, isOver } = useDroppable({
    id: `root-drop:${dataroomId}`,
    data: dropData,
  })
  return (
    <div ref={setNodeRef} className={cn('rounded-md', isOver && 'ring-2 ring-primary/60')}>
      <TreeRow isActive={isActive} onSelect={onSelect}>
        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate font-medium">Root</span>
      </TreeRow>
    </div>
  )
}

interface TreeRowProps {
  isActive: boolean
  onSelect: () => void
  disabled?: boolean
  children: React.ReactNode
}

function TreeRow({ isActive, onSelect, disabled, children }: TreeRowProps) {
  return (
    <HighlightItem activeClassName={TREE_ROW_ACTIVE}>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        data-active={isActive}
        className={cn(
          'group/tree-row peer/tree-row relative flex h-7 min-w-0 w-full -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-sidebar-foreground outline-hidden transition-colors cursor-pointer',
          '[&:not([data-highlight])]:hover:bg-sidebar-accent [&:not([data-highlight])]:hover:text-sidebar-accent-foreground',
          'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
          '[&>span:last-child]:truncate',
        )}
      >
        {children}
      </button>
    </HighlightItem>
  )
}

interface TreeNodeProps {
  node: FolderNode
  dataroomId: string
  expanded: Set<string>
  onToggle: (id: string) => void
  selectedFolderId: string | null
  onSelect: (folderId: string) => void
  onCreateChild: (parentId: string | null) => void
  onRename: (folder: Folder) => void
  onDelete: (folder: Folder) => void
  onUpload: (folderId: string) => void
}

function TreeNode({
  node,
  dataroomId,
  expanded,
  onToggle,
  selectedFolderId,
  onSelect,
  onCreateChild,
  onRename,
  onDelete,
  onUpload,
}: TreeNodeProps) {
  const isExpanded = expanded.has(node.folder.id)
  const isSelected = selectedFolderId === node.folder.id
  const hasChildren = node.children.length > 0
  const isOptimistic = node.folder.id.startsWith('temp-')

  const dragData: FolderDragData = {
    kind: 'folder',
    id: node.folder.id,
    name: node.folder.name,
    dataroomId,
    parentId: node.folder.parentId,
  }
  const dropData: FolderDropData = {
    kind: 'folder',
    folderId: node.folder.id,
    dataroomId,
  }
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `folder-tree-drag:${node.folder.id}`,
    data: dragData,
    disabled: isOptimistic,
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `folder-tree-drop:${node.folder.id}`,
    data: dropData,
    disabled: isOptimistic,
  })
  const setRefs = (el: HTMLDivElement | null) => {
    setDragRef(el)
    setDropRef(el)
  }

  const row = (
    <SidebarMenuSubItem>
      <div
        ref={setRefs}
        {...listeners}
        {...attributes}
        className={cn('rounded-md', isDragging && 'opacity-40', isOver && 'ring-2 ring-primary/60')}
      >
        <TreeRow
          isActive={isSelected}
          onSelect={() => !isOptimistic && onSelect(node.folder.id)}
          disabled={isOptimistic}
        >
          {hasChildren ? (
            <CollapsibleTrigger
              asChild
              onClick={(e) => {
                e.stopPropagation()
                onToggle(node.folder.id)
              }}
            >
              <span
                aria-hidden
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10"
              >
                <ChevronRight
                  className={cn(
                    'h-3 w-3 transition-transform duration-200',
                    isExpanded && 'rotate-90',
                  )}
                />
              </span>
            </CollapsibleTrigger>
          ) : (
            <span aria-hidden className="h-4 w-4 shrink-0" />
          )}
          {isExpanded && hasChildren ? (
            <FolderOpen className="h-3.5 w-3.5 text-primary/80" />
          ) : (
            <FolderIcon className="h-3.5 w-3.5 text-primary/70" />
          )}
          <span className="truncate">{node.folder.name}</span>
        </TreeRow>
      </div>

      {!isOptimistic ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              showOnHover
              aria-label={`Actions for ${node.folder.name}`}
              className="top-1.5"
            >
              <MoreHorizontal />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onUpload(node.folder.id)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload files
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCreateChild(node.folder.id)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              New subfolder
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRename(node.folder)}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(node.folder)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </SidebarMenuSubItem>
  )

  if (!hasChildren) {
    return row
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggle(node.folder.id)} asChild>
      {/* biome-ignore lint/complexity/noUselessFragments: Collapsible asChild needs a single element wrapping row + content */}
      <>
        {row}
        <CollapsibleContent>
          <SidebarMenuSub>
            {node.children.map((child) => (
              <TreeNode
                key={child.folder.id}
                node={child}
                dataroomId={dataroomId}
                expanded={expanded}
                onToggle={onToggle}
                selectedFolderId={selectedFolderId}
                onSelect={onSelect}
                onCreateChild={onCreateChild}
                onRename={onRename}
                onDelete={onDelete}
                onUpload={onUpload}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </>
    </Collapsible>
  )
}
