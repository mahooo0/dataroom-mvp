import type { Folder } from '@dataroom/shared'
import {
  ChevronRight,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { buildFolderTree, type FolderNode } from '@/entities/folder'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

interface FolderTreeProps {
  folders: Folder[]
  selectedFolderId: string | null
  onSelect: (folderId: string | null) => void
  onCreateChild: (parentId: string | null) => void
  onRename: (folder: Folder) => void
  onDelete: (folder: Folder) => void
}

export function FolderTree({
  folders,
  selectedFolderId,
  onSelect,
  onCreateChild,
  onRename,
  onDelete,
}: FolderTreeProps) {
  const roots = buildFolderTree(folders)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className="flex flex-col gap-1 py-2">
      <RootRow
        selected={selectedFolderId === null}
        onSelect={() => onSelect(null)}
        onCreateChild={() => onCreateChild(null)}
      />
      {roots.map((node) => (
        <TreeNode
          key={node.folder.id}
          node={node}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

interface RootRowProps {
  selected: boolean
  onSelect: () => void
  onCreateChild: () => void
}

function RootRow({ selected, onSelect, onCreateChild }: RootRowProps) {
  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition',
        selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
      )}
    >
      <button type="button" onClick={onSelect} className="flex flex-1 items-center gap-2 text-left">
        <FolderOpen className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="truncate font-medium">Root</span>
      </button>
      <Button
        size="icon"
        variant="ghost"
        onClick={onCreateChild}
        aria-label="New folder"
        className="h-6 w-6 opacity-0 group-hover:opacity-100"
      >
        <FolderPlus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

interface TreeNodeProps {
  node: FolderNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  selectedFolderId: string | null
  onSelect: (folderId: string) => void
  onCreateChild: (parentId: string | null) => void
  onRename: (folder: Folder) => void
  onDelete: (folder: Folder) => void
}

function TreeNode({
  node,
  depth,
  expanded,
  onToggle,
  selectedFolderId,
  onSelect,
  onCreateChild,
  onRename,
  onDelete,
}: TreeNodeProps) {
  const isExpanded = expanded.has(node.folder.id)
  const isSelected = selectedFolderId === node.folder.id
  const hasChildren = node.children.length > 0
  const isOptimistic = node.folder.id.startsWith('temp-')

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition',
          isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => (hasChildren ? onToggle(node.folder.id) : undefined)}
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded transition',
            hasChildren ? 'hover:bg-accent' : 'invisible',
          )}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight
            className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-90')}
          />
        </button>

        <button
          type="button"
          onClick={() => !isOptimistic && onSelect(node.folder.id)}
          disabled={isOptimistic}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {isExpanded && hasChildren ? (
            <FolderOpen className="h-4 w-4 text-primary" aria-hidden />
          ) : (
            <FolderIcon className="h-4 w-4 text-primary/70" aria-hidden />
          )}
          <span className="truncate">{node.folder.name}</span>
        </button>

        {!isOptimistic && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Actions for ${node.folder.name}`}
                className="h-6 w-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
        )}
      </div>

      {isExpanded &&
        node.children.map((child) => (
          <TreeNode
            key={child.folder.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            selectedFolderId={selectedFolderId}
            onSelect={onSelect}
            onCreateChild={onCreateChild}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
    </>
  )
}
