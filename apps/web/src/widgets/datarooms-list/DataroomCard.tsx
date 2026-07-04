import type { Dataroom } from '@dataroom/shared'
import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react'
import { DataroomOrb } from '@/entities/dataroom'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

interface DataroomCardProps {
  dataroom: Dataroom
  onRename: (dr: Dataroom) => void
  onDelete: (dr: Dataroom) => void
  onShare: (dr: Dataroom) => void
}

export function DataroomCard({ dataroom, onRename, onDelete, onShare }: DataroomCardProps) {
  const isOptimistic = dataroom.id.startsWith('temp-')

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card p-4 transition hover:border-primary/60 hover:shadow-sm">
      <Link
        to="/datarooms/$dataroomId"
        params={{ dataroomId: dataroom.id }}
        search={{ folderId: undefined }}
        disabled={isOptimistic}
        className="flex flex-col gap-3"
      >
        <div className="flex items-start justify-between gap-3">
          <DataroomOrb id={dataroom.id} iconKey={dataroom.iconKey} size={40} />
        </div>
        <div className="space-y-1">
          <h3 className="line-clamp-1 font-medium">{dataroom.name}</h3>
          <p className="text-xs text-muted-foreground">
            {isOptimistic
              ? 'Saving…'
              : `Updated ${formatDistanceToNow(new Date(dataroom.updatedAt), { addSuffix: true })}`}
          </p>
        </div>
      </Link>

      <div className="absolute right-2 top-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              disabled={isOptimistic}
              aria-label="Dataroom actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onShare(dataroom)}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRename(dataroom)}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(dataroom)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
